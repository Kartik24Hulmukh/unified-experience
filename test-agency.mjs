import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, 'server/.env') });

const geminiKey = process.env.VITE_GEMINI_API_KEY;

async function testLiveAgency() {
  console.log('🤖 --- BErozgar Specialist Squad Live Launch ---');
  console.log(`Checking API Key: ${geminiKey ? 'DETECTED' : 'MISSING'}`);
  
  if (!geminiKey) {
    console.log('Aborting test. No API key found.');
    return;
  }

  const task = 'Review the Unified Experience platform for high-priority accessibility and performance bottlenecks.';
  
  console.log(`\nTask: "${task}"`);
  console.log('Agents Deployed: Frontend Developer, Backend Architect');
  console.log('Mode: LIVE\n');
  try {
    console.log('Fetching allowed models...');
    const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
    const modelsData = await modelsRes.json();
    console.log(modelsData.models?.map(m => m.name).filter(m => m.includes('gemini')));
    
    // Original generation call
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are the BErozgar Specialist Squad (Orchestrator, Frontend Expert, Backend Architect). 
            A user has requested: "${task}". 
            Analyze this task and generate a 3-step technical execution plan as a JSON array of objects, 
            where each object has "agentId" (one of orchestrator, frontend, backend, security, product) 
            and "message" (a concise, technical status update). 
            Only respond with the JSON array.`
          }]
        }]
      })
    });

    const data = await response.json();
    console.log('[DEBUG] Gemini Response:', JSON.stringify(data, null, 2));
    const planText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Basic JSON cleaning if Gemini includes markdown
    const cleanPlan = planText.replace(/```json|```/g, '').trim();
    const dynamicSteps = JSON.parse(cleanPlan);
    
    console.log('✅ SQUAD ORCHESTRATION SUCCESSFUL. Steps generated:\n');
    dynamicSteps.forEach((step, index) => {
      console.log(`[Step ${index + 1}] Agent <${step.agentId}>: ${step.message}`);
    });

  } catch (error) {
    console.error('❌ Live orchestration failed', error);
  }
}

testLiveAgency();
