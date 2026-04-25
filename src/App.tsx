/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, RotateCcw, Cloud, Sun, CloudRain, Shield, Zap, Cpu, Activity, AlertTriangle } from 'lucide-react';
import { RaceState, Driver, Circuit, Weather, TireCompound, DriverRaceState } from './types';
import { DRIVERS, CIRCUITS, TIRES } from './constants';
import { initializeRace, simulateLap } from './simulationEngine';
import { getStrategyInsight } from './geminiService';

export default function App() {
  const [circuit, setCircuit] = useState<Circuit>(CIRCUITS[0]);
  const [raceState, setRaceState] = useState<RaceState>(initializeRace(CIRCUITS[0]));
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(500); // ms per lap
  const [selectedDriverId, setSelectedDriverId] = useState<string>(DRIVERS[0].id);
  const [aiInsight, setAiInsight] = useState<string>("Simulation idle. Select a driver and start for AI analysis.");
  const [isAiLoading, setIsAiLoading] = useState(false);

  const simulationTimer = useRef<NodeJS.Timeout | null>(null);

  // Simulation loop
  useEffect(() => {
    if (isPlaying && !raceState.isFinished) {
      simulationTimer.current = setTimeout(() => {
        setRaceState(prev => simulateLap(prev));
      }, speed);
    } else {
      setIsPlaying(false);
    }
    return () => {
      if (simulationTimer.current) clearTimeout(simulationTimer.current);
    };
  }, [isPlaying, raceState.currentLap, raceState.isFinished, speed]);

  // AI Insight update
  const fetchAiInsight = useCallback(async () => {
    if (raceState.currentLap === 0) return;
    setIsAiLoading(true);
    const insight = await getStrategyInsight(raceState, selectedDriverId);
    setAiInsight(insight);
    setIsAiLoading(false);
  }, [raceState, selectedDriverId]);

  // Auto-fetch insight every 5 laps or when manually requested
  useEffect(() => {
    if (raceState.currentLap % 10 === 0 && raceState.currentLap > 0) {
      fetchAiInsight();
    }
  }, [raceState.currentLap]);

  const handleReset = () => {
    setRaceState(initializeRace(circuit));
    setIsPlaying(false);
    setAiInsight("Simulation reset.");
  };

  const handleCircuitChange = (newCircuit: Circuit) => {
    setCircuit(newCircuit);
    setRaceState(initializeRace(newCircuit));
    setIsPlaying(false);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E4E3E0] font-sans selection:bg-[#E80020] selection:text-white p-4 md:p-8">
      {/* HUD Header */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-[#222] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="text-[#E80020] w-5 h-5" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#888]">Strategy Engine v2.5</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic">
            F1 AI Strategy <span className="text-[#E80020]">System</span>
          </h1>
        </div>

        <div className="flex flex-wrap gap-4 mt-4 md:mt-0">
          <div className="bg-[#151619] border border-[#333] rounded-lg p-3 flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase font-bold text-[#888]">Track</span>
              <select 
                className="bg-transparent border-none text-sm font-bold focus:ring-0 cursor-pointer"
                value={circuit.id}
                onChange={(e) => handleCircuitChange(CIRCUITS.find(c => c.id === e.target.value)!)}
              >
                {CIRCUITS.map(c => (
                  <option key={c.id} value={c.id} className="bg-[#151619]">{c.name}</option>
                ))}
              </select>
            </div>
            <div className="w-[1px] h-8 bg-[#333]" />
            <div className="flex flex-col">
              <span className="text-[9px] uppercase font-bold text-[#888]">Weather</span>
              <div className="flex items-center gap-2 text-sm font-bold mt-1">
                {raceState.weather === Weather.SUNNY && <Sun className="w-4 h-4 text-yellow-400" />}
                {raceState.weather === Weather.CLOUDY && <Cloud className="w-4 h-4 text-gray-400" />}
                {raceState.weather === Weather.RAIN && <CloudRain className="w-4 h-4 text-blue-400" />}
                {raceState.weather}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Race Overview */}
        <div className="lg:col-span-8 space-y-6">
          {/* Race Progress Bar */}
          <div className="bg-[#151619] border border-[#333] rounded-xl p-6 relative overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold uppercase italic flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#E80020]" />
                Live Telemetry
              </h2>
              <div className="font-mono text-2xl font-bold">
                LAP <span className="text-[#E80020]">{raceState.currentLap}</span> / {raceState.totalLaps}
              </div>
            </div>
            <div className="w-full h-1.5 bg-[#222] rounded-full mb-2">
               <motion.div 
                className="h-full bg-[#E80020]" 
                initial={{ width: 0 }}
                animate={{ width: `${(raceState.currentLap / raceState.totalLaps) * 100}%` }}
               />
            </div>
            {raceState.safetyCar && (
              <div className="mt-4 bg-yellow-900/30 border border-yellow-500/50 text-yellow-500 px-4 py-2 rounded-lg flex items-center gap-2 animate-pulse">
                <Shield className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">Safety Car Active - No Overtaking</span>
              </div>
            )}
          </div>

          {/* Driver Leaderboard */}
          <div className="bg-[#151619] border border-[#333] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#222] flex justify-between items-center bg-[#1A1B1E]">
               <span className="text-xs font-bold uppercase tracking-widest text-[#888]">Classification</span>
               <div className="flex gap-4">
                 <span className="text-[10px] text-[#555] uppercase font-bold">Gap</span>
                 <span className="text-[10px] text-[#555] uppercase font-bold">Tires</span>
               </div>
            </div>
            <div className="divide-y divide-[#222]">
              <AnimatePresence mode="popLayout">
                {(Object.values(raceState.drivers) as DriverRaceState[])
                  .sort((a, b) => a.position - b.position)
                  .map((driverState) => {
                    const driverInfo = DRIVERS.find(d => d.id === driverState.driverId)!;
                    const isSelected = selectedDriverId === driverState.driverId;
                    return (
                      <motion.div
                        layout
                        key={driverState.driverId}
                        onClick={() => setSelectedDriverId(driverState.driverId)}
                        className={`group flex items-center justify-between p-3 cursor-pointer transition-colors ${isSelected ? 'bg-[#E80020]/10 border-l-4 border-[#E80020]' : 'hover:bg-[#FFF]/5 border-l-4 border-transparent'}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-sm font-bold w-6 text-[#555]">{driverState.position}</span>
                          <div className="w-1 h-8 rounded-full" style={{ backgroundColor: driverInfo.color }} />
                          <div className="flex flex-col">
                            <span className="font-bold text-sm tracking-tight">{driverInfo.name}</span>
                            <span className="text-[10px] font-mono text-[#666] uppercase">{driverInfo.team}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                           <div className="text-right w-20">
                             <span className="font-mono text-xs font-medium">
                               {driverState.position === 1 ? 'LEADER' : `+${driverState.currentGap.toFixed(3)}`}
                             </span>
                           </div>
                           <div className="flex items-center gap-2 w-24 justify-end">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${driverState.tireCompound === TireCompound.SOFT ? 'bg-red-900/50 text-red-100 border border-red-500' : driverState.tireCompound === TireCompound.MEDIUM ? 'bg-yellow-900/50 text-yellow-100 border border-yellow-500' : 'bg-white/10 text-white border border-white'}`}>
                                {driverState.tireCompound[0]}
                              </span>
                              <div className="w-12 h-1.5 bg-[#222] rounded-full overflow-hidden">
                                <motion.div 
                                  className={`h-full ${driverState.tireHealth > 60 ? 'bg-green-500' : driverState.tireHealth > 30 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                  animate={{ width: `${driverState.tireHealth}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-mono text-[#555] w-6 text-right">L{driverState.tireAge}</span>
                           </div>
                        </div>
                      </motion.div>
                    );
                  })}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right Column: AI & Controls */}
        <div className="lg:col-span-4 space-y-6">
          {/* Simulation Controls */}
          <div className="bg-[#151619] border border-[#333] rounded-xl p-6">
             <div className="flex flex-col gap-4">
               <div className="flex gap-2">
                 <button 
                  disabled={raceState.isFinished}
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-lg font-bold uppercase tracking-widest transition-all ${isPlaying ? 'bg-orange-600 hover:bg-orange-700' : 'bg-[#E80020] hover:bg-[#FF1A38]'}`}
                 >
                   {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                   {isPlaying ? 'Pause' : 'Start Simulation'}
                 </button>
                 <button 
                  onClick={handleReset}
                  className="p-4 bg-[#222] hover:bg-[#333] rounded-lg border border-[#444] transition-colors"
                 >
                   <RotateCcw className="w-5 h-5" />
                 </button>
               </div>
               
               <div className="space-y-2">
                 <div className="flex justify-between text-[10px] font-bold uppercase text-[#888]">
                    <span>Sim Speed</span>
                    <span>{500 - speed + 500}x</span>
                 </div>
                 <input 
                  type="range" 
                  min="50" 
                  max="1000" 
                  step="50"
                  value={1050 - speed}
                  onChange={(e) => setSpeed(1050 - Number(e.target.value))}
                  className="w-full accent-[#E80020]"
                 />
               </div>
             </div>
          </div>

          {/* AI Strategy Panel */}
          <div className="bg-[#151619] border border-[#333] rounded-xl overflow-hidden">
            <div className="p-4 bg-[#1A1B1E] border-b border-[#333] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Race Engineer AI</h3>
              </div>
              <Activity className="w-4 h-4 text-emerald-400/30" />
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#222] border border-[#444] flex items-center justify-center font-black text-xl italic overflow-hidden">
                   {DRIVERS.find(d => d.id === selectedDriverId)?.shortName}
                </div>
                <div>
                   <h4 className="font-bold text-sm">{DRIVERS.find(d => d.id === selectedDriverId)?.name}</h4>
                   <p className="text-[10px] text-[#666] font-bold uppercase">{DRIVERS.find(d => d.id === selectedDriverId)?.team} Pit Wall</p>
                </div>
              </div>

              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4 min-h-[120px] flex flex-col justify-between">
                {isAiLoading ? (
                  <div className="flex flex-col items-center justify-center h-full opacity-50">
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Cpu className="w-8 h-8 text-emerald-400" />
                    </motion.div>
                    <span className="text-[10px] uppercase font-bold mt-2 tracking-widest">Analyzing Telemetry...</span>
                  </div>
                ) : (
                  <>
                    <p className="font-mono text-xs leading-relaxed text-emerald-400/90 italic">
                      "{aiInsight}"
                    </p>
                    <div className="mt-4 flex justify-end">
                      <button 
                        onClick={fetchAiInsight}
                        disabled={raceState.currentLap === 0}
                        className="text-[10px] font-bold uppercase tracking-widest text-[#888] hover:text-emerald-400 flex items-center gap-1 transition-colors disabled:opacity-0"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Request Fresh Analysis
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="p-3 bg-[#1A1B1E] border border-[#222] rounded-lg">
                  <span className="text-[9px] uppercase font-bold text-[#666]">Win Probability</span>
                  <div className="text-xl font-black mt-1">{(100 - (raceState.drivers[selectedDriverId]?.position * 8)).toFixed(1)}%</div>
                </div>
                <div className="p-3 bg-[#1A1B1E] border border-[#222] rounded-lg">
                  <span className="text-[9px] uppercase font-bold text-[#666]">Pit Window</span>
                  <div className="text-xl font-black mt-1 text-[#E80020]">
                    {Math.max(0, 5 - Math.floor(raceState.drivers[selectedDriverId]?.tireHealth / 20))} Laps
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Strategy Tip */}
          <div className="p-4 bg-blue-900/10 border border-blue-500/20 rounded-xl flex gap-4">
            <AlertTriangle className="w-6 h-6 text-blue-400 shrink-0" />
            <div className="space-y-1">
               <h5 className="text-[10px] font-black uppercase text-blue-400 tracking-wider">Strategy Insight</h5>
               <p className="text-xs text-blue-100/70 leading-normal">
                 Monitoring high degradation at {circuit.name}. The undercut is worth approximately 1.2s at this stage of the race.
               </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto mt-12 pt-6 border-t border-[#222] flex flex-col md:flex-row justify-between items-center text-[#555] gap-4">
        <div className="flex items-center gap-6 text-[10px] font-bold uppercase tracking-widest">
          <span className="hover:text-[#888] cursor-help">Tire Models</span>
          <span className="hover:text-[#888] cursor-help">Weather Engine</span>
          <span className="hover:text-[#888] cursor-help">Monte Carlo System</span>
        </div>
        <p className="text-[10px] font-mono">© 2026 QUANTUM STRATEGY LABS // CLOUD RUN DEPLOYMENT</p>
      </footer>
    </div>
  );
}
