import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import multer from 'multer';
import * as xlsx from 'xlsx';
import { parse } from 'csv-parse/sync';
import Database from 'better-sqlite3';
import fs from 'fs';

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// Initialize Database
const dbDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir);
}
const db = new Database(path.join(dbDir, 'reports.db'));

// Create reports table
db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    businessName TEXT,
    reportName TEXT,
    analysisType TEXT,
    data JSON,
    insights TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  
  const upload = multer({ storage: multer.memoryStorage() });

  // API Routes
  app.post('/api/upload', upload.single('file'), async (req: MulterRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      let data: any[] = [];
      const buffer = req.file.buffer;

      if (req.file.originalname.endsWith('.csv')) {
        data = parse(buffer.toString(), {
          columns: true,
          skip_empty_lines: true,
          cast: true
        });
      } else {
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
      }

      // Basic data cleaning: Trim strings, handle nulls
      const cleanedData = data.map(row => {
        const newRow: any = {};
        for (const key in row) {
          let value = row[key];
          if (typeof value === 'string') value = value.trim();
          newRow[key] = value === '' ? null : value;
        }
        return newRow;
      });

      res.json({ 
        filename: req.file.originalname,
        count: cleanedData.length,
        columns: cleanedData.length > 0 ? Object.keys(cleanedData[0]) : [],
        data: cleanedData.slice(0, 1000) // Limit preview data
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to process file' });
    }
  });

  app.post('/api/save-report', (req, res) => {
    try {
      const { businessName, reportName, analysisType, data, insights } = req.body;
      const stmt = db.prepare('INSERT INTO reports (businessName, reportName, analysisType, data, insights) VALUES (?, ?, ?, ?, ?)');
      const info = stmt.run(businessName, reportName, analysisType, JSON.stringify(data), insights);
      res.json({ id: info.lastInsertRowid });
    } catch (error) {
      console.error('Save report error:', error);
      res.status(500).json({ error: 'Failed to save report' });
    }
  });

  app.get('/api/reports', (req, res) => {
    try {
      const reports = db.prepare('SELECT id, businessName, reportName, analysisType, insights, createdAt FROM reports ORDER BY createdAt DESC').all();
      res.json(reports);
    } catch (error) {
      console.error('Get reports error:', error);
      res.status(500).json({ error: 'Failed to fetch reports' });
    }
  });

  app.get('/api/reports/:id', (req, res) => {
    try {
      const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
      if (!report) return res.status(404).json({ error: 'Report not found' });
      res.json({
        ...report,
        data: JSON.parse(report.data as string)
      });
    } catch (error) {
      console.error('Get report error:', error);
      res.status(500).json({ error: 'Failed to fetch report' });
    }
  });

  // Create sample CSV data
  app.get('/api/sample-csv/:type', (req, res) => {
    const { type } = req.params;
    let csv = '';
    
    if (type === 'restaurant') {
      csv = 'Date,Item,Category,Revenue,Expense,Quantity\n' +
            '2024-01-01,Pizza,Food,1500,400,100\n' +
            '2024-01-01,Pasta,Food,1200,300,80\n' +
            '2024-01-01,Wine,Beverage,800,200,40\n' +
            '2024-02-01,Pizza,Food,1800,450,120\n' +
            '2024-02-01,Pasta,Food,1100,280,75\n' +
            '2024-02-01,Wine,Beverage,950,250,50\n' +
            '2024-03-01,Pizza,Food,2000,500,130\n' +
            '2024-03-01,Dessert,Food,400,100,40\n';
    } else if (type === 'retail') {
      csv = 'Date,Product,Department,Sales,Cost,UnitsSold\n' +
            '2024-01-15,T-Shirt,Apparel,2500,1000,100\n' +
            '2024-01-20,Jeans,Apparel,4500,2000,60\n' +
            '2024-02-10,T-Shirt,Apparel,2800,1100,110\n' +
            '2024-02-15,Jeans,Apparel,4200,1900,55\n';
    } else {
       csv = 'Date,Service,ClientType,Fee,LaborCost,Hours\n' +
            '2024-01-10,Consulting,Corporate,5000,2000,20\n' +
            '2024-01-15,Training,Individual,1500,500,10\n' +
            '2024-02-05,Consulting,Corporate,6000,2500,25\n';
    }
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${type}_data.csv`);
    res.send(csv);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
