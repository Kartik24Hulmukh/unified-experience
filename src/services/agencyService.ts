/**
 * BErozgar — Agency Service
 * 
 * Orchestrates multiple AI agents using Gemini and GitHub APIs.
 * This service provides the logic for the "Agency Hub" and allows
 * specialized agents to assist with project tasks.
 */

import { env } from '@/lib/env';
import logger from '@/lib/logger';

export interface Agent {
  id: string;
  name: string;
  role: string;
  specialization: string;
  avatar: string;
  status: 'idle' | 'working' | 'completed' | 'error';
}

export const AGENCY_AGENTS: Agent[] = [
  {
    id: 'orchestrator',
    name: 'Pipeline Orchestrator',
    role: 'Lead AI Engineer',
    specialization: 'System Architecture & Workflow Design',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=orchestrator',
    status: 'idle',
  },
  {
    id: 'frontend',
    name: 'Frontend Developer',
    role: 'Senior UI/UX Engineer',
    specialization: 'React, Tailwind, GSAP & Motion',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=frontend',
    status: 'idle',
  },
  {
    id: 'backend',
    name: 'Backend Architect',
    role: 'Principal Systems Architect',
    specialization: 'Prisma, API Scalability & Security',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=backend',
    status: 'idle',
  },
  {
    id: 'security',
    name: 'Security Engineer',
    role: 'Security & Compliance Specialist',
    specialization: 'Threat Modeling & Authentication',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=security',
    status: 'idle',
  },
  {
    id: 'product',
    name: 'Product Shepherd',
    role: 'Technical Product Manager',
    specialization: 'Backlog Prioritization & User Stories',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=product',
    status: 'idle',
  },
];

class AgencyService {
  private geminiKey: string | null = null;
  private githubToken: string | null = null;

  constructor() {
    this.geminiKey = env.VITE_GEMINI_API_KEY || null;
    this.githubToken = env.VITE_GITHUB_TOKEN || null;
  }

  /**
   * Orchestrate a task across multiple agents using Gemini API
   */
  async orchestrateTask(task: string, selectedAgentIds: string[]) {
    logger.info('AgencyService', `Orchestrating task: "${task}" with agents: ${selectedAgentIds.join(', ')}`);
    
    // Simulate orchestration steps
    const steps = [
      { agentId: 'orchestrator', message: 'Analyzing task requirements and decomposing into sub-tasks...' },
      { agentId: 'product', message: 'Validating task alignment with product roadmap and user needs...' },
      { agentId: selectedAgentIds.includes('frontend') ? 'frontend' : 'orchestrator', message: 'Generating implementation strategy and technical specs...' },
    ];

    if (!this.geminiKey) {
      logger.warn('AgencyService', 'Gemini API Key missing. Running in simulation mode.');
      return { success: true, mode: 'simulation', steps };
    }

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiKey}`, {
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
          }],
          generationConfig: {
            responseMimeType: "application/json",
          }
        })
      });

      const data = await response.json();
      const planText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      const dynamicSteps = JSON.parse(planText);

      return { success: true, mode: 'live', steps: dynamicSteps };
    } catch (error) {
      logger.error('AgencyService', 'Live orchestration failed, falling back to simulation', error);
      return { success: true, mode: 'simulation', steps };
    }
  }

  /**
   * Fetch context from GitHub to help agents understand the codebase
   */
  async getGithubContext(repo: string, path: string) {
    if (!this.githubToken) {
      logger.warn('AgencyService', 'GitHub Token missing. Cannot fetch live context.');
      return null;
    }
    // GitHub API integration logic here
    return { repo, path, status: 'mocked' };
  }
}

export const agencyService = new AgencyService();
export default agencyService;
