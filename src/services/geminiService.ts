import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface AnalysisResult {
  summary: string;
  keyMetrics: {
    label: string;
    value: string | number;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
  }[];
  topPerformers: { name: string; value: number }[];
  bottomPerformers: { name: string; value: number }[];
  recommendations: string[];
  suggestedCharts: {
    type: 'bar' | 'line' | 'pie';
    title: string;
    xAxis: string;
    yAxis: string;
  }[];
}

export async function analyzeBusinessData(data: any[], businessType: string): Promise<AnalysisResult> {
  const dataSummary = data.slice(0, 10); // Provide a sample of data
  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  const prompt = `
    You are a professional business analyst. Analyze this small business data for a ${businessType}.
    
    COLUMNS: ${columns.join(', ')}
    DATA SAMPLE (JSON): ${JSON.stringify(dataSummary)}
    TOTAL RECORDS: ${data.length}

    TASK:
    1. Detect the most important business metrics (Revenue, Profit, Sales, etc.).
    2. Identify trends and key performance indicators.
    3. Find the Top 10 best and Bottom 10 worst performing items/services based on the data.
    4. Provide specific, actionable business recommendations.
    5. Suggest the best 3 charts to visualize this data.

    Return the analysis in a structured JSON format matching this schema:
    {
      "summary": "Executive summary of the business state",
      "keyMetrics": [
        { "label": "Revenue", "value": "$50,000", "trend": "up", "trendValue": "12%" }
      ],
      "topPerformers": [
        { "name": "Item A", "value": 5000 }
      ],
      "bottomPerformers": [
        { "name": "Item Z", "value": 100 }
      ],
      "recommendations": [
        "Increase marketing for Item Z"
      ],
      "suggestedCharts": [
        { "type": "line", "title": "Revenue vs Date", "xAxis": "date", "yAxis": "revenue" }
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const result = JSON.parse(response.text || '{}');
    return result as AnalysisResult;
  } catch (error) {
    console.error("Gemini analysis error:", error);
    throw new Error("Failed to analyze data with AI");
  }
}
