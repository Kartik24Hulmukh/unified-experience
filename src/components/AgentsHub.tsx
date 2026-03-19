import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Terminal, 
  Cpu, 
  Shield, 
  Layout, 
  ChevronRight, 
  Play, 
  CheckCircle2, 
  Loader2, 
  Sparkles,
  Github,
  Key
} from 'lucide-react';
import { AGENCY_AGENTS, Agent, agencyService } from '@/services/agencyService';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const AgentsHub: React.FC = () => {
  const [selectedAgents, setSelectedAgents] = useState<string[]>(['orchestrator']);
  const [isLaunching, setIsLaunching] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [simulationSteps, setSimulationSteps] = useState<any[]>([]);
  const [taskInput, setTaskInput] = useState('Optimize the Resale module for mobile performance');

  const toggleAgent = (id: string) => {
    if (id === 'orchestrator') return; // Orchestrator is always required
    setSelectedAgents(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const handleLaunch = async () => {
    setIsLaunching(true);
    setActiveStep(0);
    
    const result = await agencyService.orchestrateTask(taskInput, selectedAgents);
    setSimulationSteps(result.steps || []);

    // Simulate the visual progression
    for (let i = 0; i < (result.steps?.length || 0); i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        setActiveStep(i + 1);
    }

    setTimeout(() => {
        setIsLaunching(false);
        setActiveStep(0);
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-white pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="outline" className="mb-4 py-1 px-4 border-black/10 text-black/60 uppercase tracking-widest text-[10px]">
              Development System v4.0
            </Badge>
            <h1 className="text-5xl md:text-7xl font-display font-bold text-black mb-6 tracking-tight uppercase">
              Agency <span className="text-black/30">Hub</span>
            </h1>
            <p className="text-xl text-black/60 max-w-2xl mx-auto font-body">
              Deploy specialized AI agents into your unified experience. 
              Powered by <span className="text-black font-semibold">Gemini API</span> & <span className="text-black font-semibold">GitHub Context</span>.
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Agent Selection Panel */}
          <div className="lg:col-span-8 space-y-6">
            <h2 className="text-sm uppercase tracking-widest font-bold text-black/40 mb-4 flex items-center gap-2">
              <Users className="w-4 h-4" /> Available Specialist Squad
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {AGENCY_AGENTS.map((agent) => (
                <motion.div
                  key={agent.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => toggleAgent(agent.id)}
                  className={`relative p-6 rounded-2xl border-2 transition-all cursor-pointer ${
                    selectedAgents.includes(agent.id)
                      ? 'border-black bg-black text-white shadow-xl'
                      : 'border-black/5 bg-black/[0.02] text-black hover:border-black/20'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      selectedAgents.includes(agent.id) ? 'bg-white/10' : 'bg-black/5'
                    }`}>
                      {agent.id === 'orchestrator' && <Cpu className="w-6 h-6" />}
                      {agent.id === 'frontend' && <Layout className="w-6 h-6" />}
                      {agent.id === 'backend' && <Terminal className="w-6 h-6" />}
                      {agent.id === 'security' && <Shield className="w-6 h-6" />}
                      {agent.id === 'product' && <Sparkles className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{agent.name}</h3>
                      <p className={`text-xs uppercase tracking-wider mb-2 ${
                        selectedAgents.includes(agent.id) ? 'text-white/60' : 'text-black/40'
                      }`}>
                        {agent.role}
                      </p>
                      <p className={`text-sm ${
                        selectedAgents.includes(agent.id) ? 'text-white/80' : 'text-black/60'
                      }`}>
                        {agent.specialization}
                      </p>
                    </div>
                  </div>
                  {selectedAgents.includes(agent.id) && (
                    <motion.div
                      layoutId="check"
                      className="absolute top-4 right-4 text-[#a3ff12]"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Command Center */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="p-6 border-2 border-black bg-white shadow-2xl rounded-3xl overflow-hidden relative">
              <div className="flex items-center justify-between mb-8">
                <h2 className="font-display font-bold text-xl uppercase tracking-tight">Command Center</h2>
                <Badge variant="outline" className="border-black/20 font-mono text-[10px]">
                  LIVE v0.1
                </Badge>
              </div>

              <div className="space-y-4 mb-8">
                <label className="text-[10px] uppercase tracking-widest font-bold text-black/40">Task Directive</label>
                <textarea
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  className="w-full h-32 p-4 bg-black/[0.03] border-none rounded-xl text-sm font-body focus:ring-2 focus:ring-black transition-all resize-none"
                  placeholder="Describe what the squad should build..."
                />
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-bold text-black/40">
                  <span>API Integration</span>
                  <span className="text-[#a3ff12]">Connected</span>
                </div>
                <div className="flex gap-2">
                  <Badge className="bg-black text-white px-2 py-1 flex gap-2 items-center">
                    <Key className="w-3 h-3" /> Gemini
                  </Badge>
                  <Badge className="bg-black text-white px-2 py-1 flex gap-2 items-center">
                    <Github className="w-3 h-3" /> GitHub
                  </Badge>
                </div>
              </div>

              <Button
                onClick={handleLaunch}
                disabled={isLaunching || selectedAgents.length < 2}
                className="w-full h-14 rounded-2xl bg-black text-white hover:bg-black/90 text-lg font-bold group"
              >
                {isLaunching ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    EXECUTING...
                  </>
                ) : (
                  <>
                    LAUNCH SQUAD
                    <Play className="ml-2 h-5 w-5 fill-current group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>

              <p className="mt-4 text-[10px] text-center text-black/40 uppercase tracking-widest">
                Deployment triggers multi-agent orchestration
              </p>
            </Card>

            {/* Simulation View */}
            <AnimatePresence>
              {isLaunching && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="mt-6 p-6 rounded-3xl bg-black text-white border-none shadow-2xl relative overflow-hidden"
                >
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[10px] font-mono tracking-widest uppercase text-white/40">Orchestration in progress</span>
                    </div>
                    <div className="space-y-6">
                      {simulationSteps.map((step, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ 
                            opacity: activeStep >= idx ? 1 : 0.2,
                            x: activeStep >= idx ? 0 : -20 
                          }}
                          className="flex gap-4"
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            activeStep === idx ? 'bg-[#a3ff12] text-black' : 'bg-white/10'
                          }`}>
                            {activeStep > idx ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
                              {step.agentId}
                            </p>
                            <p className="text-sm font-body leading-relaxed">
                              {step.message}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                  {/* Subtle background glow */}
                  <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-[#a3ff12]/10 rounded-full blur-3xl" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentsHub;
