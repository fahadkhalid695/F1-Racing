/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, RotateCcw, Cloud, Sun, CloudRain, Shield, Zap, Cpu, Activity, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { RaceState, Driver, Circuit, Weather, TireCompound, DriverRaceState } from './types';
import { DRIVERS, CIRCUITS, TIRES } from './constants';
import { initializeRace, simulateLap } from './simulationEngine';
import { getStrategyInsight, getWhatIfProjection } from './geminiService';
import { runMonteCarlo, ProbabilityResult } from './services/predictionService';

export default function App() {
  const [circuit, setCircuit] = useState<Circuit>(CIRCUITS[0]);
  const [raceState, setRaceState] = useState<RaceState>(initializeRace(CIRCUITS[0]));
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(500); // ms per lap
  const [selectedDriverId, setSelectedDriverId] = useState<string>(DRIVERS[0].id);
  const [aiInsight, setAiInsight] = useState<string>("Simulation idle. Select a driver and start for AI analysis.");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [whatIfLap, setWhatIfLap] = useState<number>(30);
  const [whatIfCompound, setWhatIfCompound] = useState<TireCompound>(TireCompound.MEDIUM);
  const [whatIfResult, setWhatIfResult] = useState<string | null>(null);
  const [isWhatIfLoading, setIsWhatIfLoading] = useState(false);
  const [predictions, setPredictions] = useState<ProbabilityResult[]>([]);
  const [isPredicting, setIsPredicting] = useState(false);
  const [liveTelemetry, setLiveTelemetry] = useState({ speed: 0, rpm: 0, fl: 0, fr: 0, rl: 0, rr: 0 });

  const simulationTimer = useRef<NodeJS.Timeout | null>(null);

  // Live telemetry oscillation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        const driver = raceState.drivers[selectedDriverId];
        if (driver && driver.telemetry) {
          setLiveTelemetry({
            speed: driver.telemetry.speed + (Math.random() - 0.5) * 8,
            rpm: driver.telemetry.rpm + (Math.random() - 0.5) * 400,
            fl: driver.telemetry.tireTemp.fl + (Math.random() - 0.5) * 0.4,
            fr: driver.telemetry.tireTemp.fr + (Math.random() - 0.5) * 0.4,
            rl: driver.telemetry.tireTemp.rl + (Math.random() - 0.5) * 0.4,
            rr: driver.telemetry.tireTemp.rr + (Math.random() - 0.5) * 0.4,
          });
        }
      }, 50);
    } else {
      const driver = raceState.drivers[selectedDriverId];
      if (driver && driver.telemetry) {
        setLiveTelemetry({
          speed: driver.telemetry.speed,
          rpm: driver.telemetry.rpm,
          fl: driver.telemetry.tireTemp.fl,
          fr: driver.telemetry.tireTemp.fr,
          rl: driver.telemetry.tireTemp.rl,
          rr: driver.telemetry.tireTemp.rr,
        });
      }
    }
    return () => clearInterval(interval);
  }, [isPlaying, selectedDriverId, raceState.drivers]);

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
    setWhatIfResult(null);
  };

  const runWhatIf = async () => {
    setIsWhatIfLoading(true);
    const result = await getWhatIfProjection(raceState, selectedDriverId, whatIfLap, whatIfCompound);
    setWhatIfResult(result);
    setIsWhatIfLoading(false);
  };

  const handleRunPredictions = () => {
    setIsPredicting(true);
    const results = runMonteCarlo(raceState, 50);
    setPredictions(results);
    setIsPredicting(false);
  };

  const handleCircuitChange = (newCircuit: Circuit) => {
    setCircuit(newCircuit);
    setRaceState(initializeRace(newCircuit));
    setIsPlaying(false);
  };

  const lapHistoryData = raceState.history
    .filter(h => h.driverId === selectedDriverId)
    .slice(-10)
    .map(h => ({
      lap: `L${h.lap}`,
      lapTime: parseFloat(h.lapTime.toFixed(3))
    }));

  const avgLapTime = lapHistoryData.length > 0 
    ? parseFloat((lapHistoryData.reduce((acc, curr) => acc + curr.lapTime, 0) / lapHistoryData.length).toFixed(3))
    : 0;

  const currentPred = predictions.find(p => p.driverId === selectedDriverId);

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white font-sans selection:bg-[#E10600] selection:text-white flex flex-col">
      {/* HUD Header */}
      <header className="h-[70px] border-b border-[#2A2A2D] flex items-center justify-between px-8 bg-[#151517] shrink-0">
        <div className="flex items-center gap-6">
          <div className="text-[#E10600] font-black italic text-2xl tracking-tighter">F1 AI STRATEGY</div>
          <div className="h-8 w-px bg-white/10"></div>
          <div className="flex flex-col">
            <span className="text-[10px] text-[#8E9299] uppercase tracking-widest">Circuit</span>
            <select 
              className="bg-transparent border-none text-[13px] font-bold uppercase p-0 focus:ring-0 cursor-pointer text-white"
              value={circuit.id}
              onChange={(e) => handleCircuitChange(CIRCUITS.find(c => c.id === e.target.value)!)}
            >
              {CIRCUITS.map(c => (
                <option key={c.id} value={c.id} className="bg-[#151517]">{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-12">
          <div className="text-center">
             <div className="text-[10px] text-[#8E9299] uppercase">Lap</div>
             <div className="text-xl font-bold data-mono uppercase tracking-tight">
               {raceState.currentLap} / {raceState.totalLaps}
             </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-[#8E9299] uppercase">Weather</div>
            <div className="flex items-center gap-2">
              {raceState.weather === Weather.SUNNY && <span className="text-[#FFF200] font-bold text-sm">SUNNY</span>}
              {raceState.weather === Weather.CLOUDY && <span className="text-[#8E9299] font-bold text-sm">CLOUDY</span>}
              {raceState.weather === Weather.RAIN && <span className="text-[#00D2BE] font-bold text-sm">RAIN</span>}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-[#8E9299] uppercase">Status</div>
            {raceState.safetyCar ? (
              <div className="flex items-center gap-2 px-3 py-1 bg-yellow-500/20 border border-yellow-500 rounded animate-pulse">
                <Shield className="w-4 h-4 text-yellow-500" />
                <span className="text-yellow-500 font-black text-sm uppercase">Safety Car</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="font-bold text-sm uppercase">{isPlaying ? 'Live Sim' : 'Paused'}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden grid grid-cols-[300px_1fr_300px]">
        {/* Sidebar Left: Leaderboard */}
        <aside className="border-r border-[#2A2A2D] flex flex-col bg-[#151517] overflow-hidden">
          <div className="p-4 border-b border-[#2A2A2D] bg-white/5">
            <span className="text-xs font-bold uppercase tracking-widest">Leaderboard</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-[#2A2A2D]">
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
                      className={`group grid grid-cols-[45px_1fr_75px] items-center p-3 cursor-pointer transition-all duration-500 rounded relative ${isSelected ? 'bg-[#E10600]/15' : 'hover:bg-white/5'}`}
                      initial={{ opacity: 0 }}
                      animate={{ 
                        opacity: 1,
                        backgroundColor: 
                          driverState.lastEvent === 'OVERTAKE_SUCCESS' ? 'rgba(0, 210, 190, 0.15)' : 
                          driverState.lastEvent === 'OVERTAKE_FAILED' ? 'rgba(255, 24, 1, 0.1)' : 
                          isSelected ? 'rgba(225, 6, 0, 0.15)' : 'rgba(21, 21, 23, 0)'
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`font-black data-mono text-xs ${driverState.position === 1 ? 'text-[#E10600]' : 'text-[#8E9299]'}`}>
                          {driverState.position}
                        </span>
                        <div className="flex flex-col items-center">
                          {driverState.position < driverState.prevPosition && <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[5px] border-b-[#00D2BE] mb-0.5" />}
                          {driverState.position > driverState.prevPosition && <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[5px] border-t-[#FF1801] mt-0.5" />}
                        </div>
                      </div>
                        <div className="flex flex-col min-w-0 pl-1 border-l-2" style={{ borderColor: driverInfo.color }}>
                           <div className="flex items-center gap-1.5 min-w-0">
                             <span className="font-black uppercase text-[12px] truncate italic tracking-tighter">
                               {driverInfo.name.split(' ').pop()}
                             </span>
                             {driverState.lastEvent === 'PIT_STOP' && <span className="bg-white/10 text-white text-[8px] px-1 font-bold rounded">PIT</span>}
                           </div>
                           <span className="text-[9px] text-[#8E9299] uppercase font-black tracking-widest">{driverInfo.team}</span>
                        </div>
                        <div className="text-right data-mono text-[11px] font-bold">
                           {driverState.position === 1 ? 'LEADER' : `+${driverState.currentGap.toFixed(3)}`}
                        </div>
                    </motion.div>
                  );
                })}
            </AnimatePresence>
          </div>
        </aside>

        {/* Main Panel: Telemetry & Detail */}
        <main className="p-6 flex flex-col gap-6 bg-[#0E0E10] overflow-y-auto">
          <section className="grid grid-cols-2 gap-6">
            {/* Primary Driver Panel */}
            <div className="bg-[#151517] border border-[#2A2A2D] p-5 rounded">
              <div className="flex justify-between mb-4">
                <h2 className="text-xs font-bold uppercase text-[#8E9299] tracking-widest">Target Driver Analysis</h2>
                <span className="text-[#E10600] font-black italic text-lg uppercase">P{raceState.drivers[selectedDriverId]?.position}</span>
              </div>
              <div className="flex items-end gap-3 mb-6">
                <div className="text-4xl font-black uppercase tracking-tighter leading-none italic">
                  {DRIVERS.find(d => d.id === selectedDriverId)?.name.split(' ').pop()}
                </div>
                <div className="text-xl data-mono mb-px opacity-50 font-bold">
                  {DRIVERS.find(d => d.id === selectedDriverId)?.id.padStart(2, '0')}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 border border-[#2A2A2D] bg-white/5">
                  <div className="text-[10px] text-[#8E9299] uppercase font-bold tracking-widest mb-2 text-center">Tires</div>
                  <div className="flex items-center justify-center gap-3">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-black ${
                      raceState.drivers[selectedDriverId]?.tireCompound === TireCompound.SOFT ? 'border-red-500 text-red-500' :
                      raceState.drivers[selectedDriverId]?.tireCompound === TireCompound.MEDIUM ? 'border-yellow-500 text-yellow-500' :
                      raceState.drivers[selectedDriverId]?.tireCompound === TireCompound.HARD ? 'border-white text-white' :
                      'border-[#00D2BE] text-[#00D2BE]'
                    }`}>
                      {raceState.drivers[selectedDriverId]?.tireCompound[0]}
                    </div>
                    <span className="font-bold uppercase text-sm tracking-tight">{raceState.drivers[selectedDriverId]?.tireCompound}</span>
                  </div>
                  <div className="mt-3 h-1.5 bg-white/10 w-full overflow-hidden rounded-full">
                    <motion.div 
                      className={`h-full ${raceState.drivers[selectedDriverId]?.tireHealth > 60 ? 'bg-[#00D2BE]' : raceState.drivers[selectedDriverId]?.tireHealth > 25 ? 'bg-[#FFF200]' : 'bg-[#FF1801]'}`}
                      animate={{ width: `${raceState.drivers[selectedDriverId]?.tireHealth}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[8px] mt-1.5 data-mono text-[#8E9299] uppercase font-bold">
                    <span>Age: {raceState.drivers[selectedDriverId]?.tireAge}L</span>
                    <span>Wear: {(100 - raceState.drivers[selectedDriverId]?.tireHealth).toFixed(0)}%</span>
                  </div>
                </div>

                <div className="p-3 border border-[#2A2A2D] bg-white/5 flex flex-col justify-between">
                  <div>
                    <div className="text-[10px] text-[#8E9299] uppercase font-bold tracking-widest text-center">Reference Lap</div>
                    <div className="text-xl data-mono mt-2 font-bold text-center tracking-tighter">
                      {raceState.drivers[selectedDriverId]?.lastLapTime.toFixed(3)}s
                    </div>
                  </div>
                  <div className={`text-[9px] text-center font-bold uppercase tracking-widest ${raceState.drivers[selectedDriverId]?.lastLapTime < circuit.baseLapTime ? 'text-[#00D2BE]' : 'text-[#FF1801]'}`}>
                    {raceState.drivers[selectedDriverId]?.lastLapTime < circuit.baseLapTime ? '▼ -0.322 vs AVG' : '▲ +0.105 vs AVG'}
                  </div>
                </div>
              </div>

              {/* Live Telemetry Section */}
              <div className="mt-4 p-4 bg-black/40 border border-[#2A2A2D] rounded">
                <div className="flex justify-between items-center mb-4">
                   <div className="flex items-center gap-2">
                     <Activity className="w-3 h-3 text-[#E10600]" />
                     <span className="text-[10px] uppercase font-black tracking-widest text-[#8E9299]">Live Systems Telemetry</span>
                   </div>
                   <div className="text-[10px] data-mono text-emerald-500 font-bold animate-pulse">REC ●</div>
                </div>
                
                <div className="grid grid-cols-2 gap-6 items-center">
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-[8px] uppercase font-bold text-[#666] mb-1">
                        <span>Speed</span>
                        <span className="text-white">{Math.round(liveTelemetry.speed)} KM/H</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-[#E10600]" 
                          animate={{ width: `${(liveTelemetry.speed / 350) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[8px] uppercase font-bold text-[#666] mb-1">
                        <span>RPM</span>
                        <span className="text-white">{Math.round(liveTelemetry.rpm)}</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-[#00D2BE]" 
                          animate={{ width: `${(liveTelemetry.rpm / 15000) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center p-1.5 bg-white/5 rounded border border-white/5">
                      <div className="text-[7px] uppercase font-bold text-[#666]">FL Temp</div>
                      <div className={`text-[10px] data-mono font-bold ${liveTelemetry.fl > 110 ? 'text-red-500' : 'text-white'}`}>
                        {liveTelemetry.fl.toFixed(1)}°C
                      </div>
                    </div>
                    <div className="text-center p-1.5 bg-white/5 rounded border border-white/5">
                      <div className="text-[7px] uppercase font-bold text-[#666]">FR Temp</div>
                      <div className={`text-[10px] data-mono font-bold ${liveTelemetry.fr > 110 ? 'text-red-500' : 'text-white'}`}>
                        {liveTelemetry.fr.toFixed(1)}°C
                      </div>
                    </div>
                    <div className="text-center p-1.5 bg-white/5 rounded border border-white/5">
                      <div className="text-[7px] uppercase font-bold text-[#666]">RL Temp</div>
                      <div className={`text-[10px] data-mono font-bold ${liveTelemetry.rl > 110 ? 'text-red-500' : 'text-white'}`}>
                        {liveTelemetry.rl.toFixed(1)}°C
                      </div>
                    </div>
                    <div className="text-center p-1.5 bg-white/5 rounded border border-white/5">
                      <div className="text-[7px] uppercase font-bold text-[#666]">RR Temp</div>
                      <div className={`text-[10px] data-mono font-bold ${liveTelemetry.rr > 110 ? 'text-red-500' : 'text-white'}`}>
                        {liveTelemetry.rr.toFixed(1)}°C
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/5">
                <div className="text-center">
                  <div className="text-[8px] text-[#8E9299] uppercase font-bold tracking-widest mb-1">Skill</div>
                  <div className="flex items-center justify-center gap-1">
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${DRIVERS.find(d => d.id === selectedDriverId)?.skill}%` }}></div>
                    </div>
                    <span className="text-[10px] font-bold data-mono">{DRIVERS.find(d => d.id === selectedDriverId)?.skill}</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[8px] text-[#8E9299] uppercase font-bold tracking-widest mb-1">Aggression</div>
                  <div className="flex items-center justify-center gap-1">
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500" style={{ width: `${DRIVERS.find(d => d.id === selectedDriverId)?.aggression}%` }}></div>
                    </div>
                    <span className="text-[10px] font-bold data-mono">{DRIVERS.find(d => d.id === selectedDriverId)?.aggression}</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[8px] text-[#8E9299] uppercase font-bold tracking-widest mb-1">Consistency</div>
                  <div className="flex items-center justify-center gap-1">
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-500" style={{ width: `${DRIVERS.find(d => d.id === selectedDriverId)?.consistency}%` }}></div>
                    </div>
                    <span className="text-[10px] font-bold data-mono">{DRIVERS.find(d => d.id === selectedDriverId)?.consistency}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#151517] border border-[#2A2A2D] p-5 rounded">
              <div className="text-xs font-bold uppercase text-[#8E9299] tracking-widest mb-4">Monte Carlo Forecast</div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Expected Finish</span>
                  <span className={`text-xl data-mono font-black ${currentPred ? 'text-[#00D2BE]' : 'opacity-20'}`}>
                    {currentPred ? `P${currentPred.expectedPosition.toFixed(1)}` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Win Prob.</span>
                  <span className="text-xl data-mono font-bold tracking-tighter">
                    {currentPred ? `${currentPred.probabilities.win.toFixed(1)}%` : '--'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Podium Prob.</span>
                  <span className="text-xl data-mono font-bold tracking-tighter">
                    {currentPred ? `${currentPred.probabilities.podium.toFixed(1)}%` : '--'}
                  </span>
                </div>
                <div className="h-px bg-white/10"></div>
                <div className="p-3 border border-dashed border-[#E10600]/40 bg-[#E10600]/5 min-h-[90px]">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-3 h-3 text-[#E10600]" />
                    <div className="text-[10px] text-[#E10600] uppercase font-black tracking-widest">AI Strategy Core</div>
                  </div>
                  {isAiLoading ? (
                    <div className="text-[10px] uppercase font-bold opacity-30 italic animate-pulse">Computing alternative lines...</div>
                  ) : (
                    <div className="text-[11px] leading-snug uppercase font-black tracking-tight text-white/90">
                      {aiInsight.slice(0, 100)}...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Large Telemetry/Graph Placeholder */}
          <section className="flex-1 bg-[#151517] border border-[#2A2A2D] p-5 rounded relative flex flex-col flex-1 overflow-hidden">
            <div className="text-xs font-bold uppercase text-[#8E9299] tracking-widest mb-4 flex items-center justify-between shrink-0">
              <span>Lap Time Trends (Last 10 Laps)</span>
              <div className="flex items-center gap-4 text-[10px]">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#E10600]"></div> LAP TIME</div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-[1px] border-t border-dashed border-white/40"></div> AVG REF</div>
              </div>
            </div>
            
            <div className="flex-1 w-full h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lapHistoryData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2D" vertical={false} />
                  <XAxis 
                    dataKey="lap" 
                    stroke="#444" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#444" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#151517', border: '1px solid #2A2A2D', fontSize: '10px' }}
                    itemStyle={{ color: '#E10600' }}
                  />
                  <ReferenceLine y={avgLapTime} stroke="white" strokeDasharray="3 3" opacity={0.3} />
                  <Line 
                    type="monotone" 
                    dataKey="lapTime" 
                    stroke="#E10600" 
                    strokeWidth={3} 
                    dot={{ fill: '#E10600', r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                    animationDuration={1000}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-4 mt-6 gap-6 text-center shrink-0">
              <div className="border-r border-[#2A2A2D]">
                <div className="text-[9px] text-[#8E9299] uppercase font-bold mb-1">Fuel Delta</div>
                <div className="data-mono text-xl font-bold tracking-tight text-white">+1.22 kg</div>
              </div>
              <div className="border-r border-[#2A2A2D]">
                <div className="text-[9px] text-[#8E9299] uppercase font-bold mb-1">Avg 10L</div>
                <div className="data-mono text-xl font-bold tracking-tight text-[#FFF200]">{avgLapTime > 0 ? avgLapTime.toFixed(3) : '--'}s</div>
              </div>
              <div className="border-r border-[#2A2A2D]">
                <div className="text-[9px] text-[#8E9299] uppercase font-bold mb-1">Overtake Prob.</div>
                <div className="data-mono text-xl font-bold tracking-tight text-white">42%</div>
              </div>
              <div>
                <div className="text-[9px] text-[#8E9299] uppercase font-bold mb-1">Track Grip</div>
                <div className="data-mono text-xl font-bold tracking-tight text-[#00D2BE]">Optimal</div>
              </div>
            </div>
          </section>
        </main>

        {/* Sidebar Right: Alerts & Controls */}
        <aside className="border-l border-[#2A2A2D] bg-[#151517] p-5 flex flex-col gap-6 overflow-y-auto">
          <div>
            <div className="text-xs font-bold uppercase text-[#8E9299] tracking-widest mb-4">Strategic Alerts</div>
            <div className="flex flex-col gap-3">
              <AnimatePresence>
                {raceState.weather === Weather.RAIN && (
                  <motion.div 
                    key="weather-rain-alert"
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="p-3 bg-blue-900/20 border-l-4 border-blue-500 text-[11px] leading-normal"
                  >
                    <span className="font-black block mb-1 uppercase text-blue-400">Weather Alert</span>
                    Precipitation increasing. Box for Intermediates or Wets if conditions persist.
                  </motion.div>
                )}
                {raceState.drivers[selectedDriverId]?.tireHealth < 35 && (
                  <motion.div 
                    key="tire-wear-alert"
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="p-3 bg-red-950/20 border-l-4 border-[#E10600] text-[11px] leading-normal"
                  >
                    <span className="font-black block mb-1 uppercase text-[#E10600]">Critical Wear</span>
                    Tire health below 35%. Efficiency dropping significantly. Pit window open.
                  </motion.div>
                )}
              <AnimatePresence mode="popLayout">
                {raceState.messages && raceState.messages.length > 0 && (
                  <motion.div 
                    key={raceState.messages[raceState.messages.length - 1].text}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`p-3 border-l-4 text-[11px] leading-normal ${
                      raceState.messages[raceState.messages.length - 1].type === 'SC' ? 'bg-yellow-900/20 border-yellow-500' : 
                      raceState.messages[raceState.messages.length - 1].type === 'CRITICAL' ? 'bg-red-950/20 border-red-500' : 
                      'bg-white/5 border-[#8E9299]'
                    }`}
                  >
                    <span className="font-black block mb-1 uppercase">Track Update</span>
                    {raceState.messages[raceState.messages.length - 1].text}
                  </motion.div>
                )}
              </AnimatePresence>
              </AnimatePresence>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-[#2A2A2D]">
        <div className="text-xs font-bold uppercase text-[#8E9299] tracking-widest mb-3">Monte Carlo Engine</div>
        <div className="text-[9px] mb-3 leading-tight opacity-50 font-bold uppercase tracking-tighter">
          Runs 50 background simulations to calculate finish probabilities based on current wear and pace.
        </div>
        <button 
          onClick={handleRunPredictions}
          disabled={isPredicting || raceState.currentLap === 0}
          className="w-full bg-[#E10600] text-white font-black uppercase py-2.5 rounded text-[10px] tracking-[0.2em] mb-4 hover:bg-[#C10500] transition-colors disabled:opacity-30 ripple"
        >
          {isPredicting ? 'RUNNING SIMULATIONS...' : 'PREDICT FINAL OUTCOME'}
        </button>

        <div className="text-xs font-bold uppercase text-[#8E9299] tracking-widest mb-3">Strategy What-If</div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col">
              <label className="text-[8px] uppercase font-bold text-[#666] mb-1">Target Lap</label>
              <input 
                type="number" 
                min={raceState.currentLap + 1} 
                max={raceState.totalLaps}
                value={whatIfLap}
                onChange={(e) => setWhatIfLap(Number(e.target.value))}
                className="bg-[#1A1B1E] border border-[#333] text-[10px] rounded p-1 text-white"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[8px] uppercase font-bold text-[#666] mb-1">Compound</label>
              <select 
                value={whatIfCompound}
                onChange={(e) => setWhatIfCompound(e.target.value as TireCompound)}
                className="bg-[#1A1B1E] border border-[#333] text-[10px] rounded p-1 text-white"
              >
                <option value={TireCompound.SOFT}>Soft</option>
                <option value={TireCompound.MEDIUM}>Medium</option>
                <option value={TireCompound.HARD}>Hard</option>
                <option value={TireCompound.WET}>Wet</option>
              </select>
            </div>
          </div>
          
          <button 
            onClick={runWhatIf}
            disabled={isWhatIfLoading || raceState.currentLap === 0}
            className="w-full bg-white/10 hover:bg-white/20 text-white font-black uppercase py-2 rounded text-[9px] tracking-widest disabled:opacity-30 transition-all"
          >
            {isWhatIfLoading ? 'Analyzing...' : 'Run Scenario'}
          </button>

          {whatIfResult && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded animate-in fade-in slide-in-from-top-1">
               <div className="flex items-center gap-1.5 mb-1">
                 <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                 <div className="text-[8px] uppercase font-black text-emerald-400">Projection outcome</div>
               </div>
               <p className="text-[10px] italic leading-tight text-emerald-100/90 leading-relaxed font-medium">"{whatIfResult}"</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto pt-6 border-t border-[#2A2A2D] flex flex-col gap-3">
            <div className="text-xs font-bold uppercase text-[#8E9299] tracking-widest mb-1">Sim Operations</div>
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className={`w-full py-2.5 rounded font-black uppercase text-[11px] tracking-widest transition-all ${isPlaying ? 'bg-[#2A2A2D] text-white' : 'bg-white text-black'}`}
            >
              {isPlaying ? 'PAUSE ENGINE' : 'START SIMULATION'}
            </button>
            <button 
              onClick={handleReset}
              className="w-full border border-white/10 hover:bg-white/5 text-white/50 hover:text-white py-2 rounded font-black uppercase text-[11px] tracking-widest transition-all"
            >
              RESET HISTORY
            </button>
            
            <div className="bg-white/5 p-3 rounded mt-2">
               <div className="flex justify-between items-center mb-2">
                 <span className="text-[9px] font-black uppercase text-[#8E9299]">Playback Spd</span>
                 <span className="text-[10px] data-mono font-bold">{(1050 - speed) / 10}x</span>
               </div>
               <input 
                type="range" 
                min="50" 
                max="1000" 
                step="50"
                value={1050 - speed}
                onChange={(e) => setSpeed(1050 - Number(e.target.value))}
                className="w-full accent-[#E10600] h-1"
               />
            </div>
          </div>
        </aside>
      </div>

      <footer className="h-[60px] border-t border-[#2A2A2D] bg-[#151517] flex items-center px-8 shrink-0">
        <div className="flex items-center gap-3">
           <div className={`w-2 h-2 rounded-full ${isAiLoading ? 'bg-[#E10600] animate-ping' : 'bg-[#00D2BE]'}`}></div>
           <span className="text-[10px] font-black uppercase tracking-widest text-[#8E9299] italic">
             AI Core: v2.5.0-Stable // Simulation Ready
           </span>
        </div>
        <div className="ml-auto flex items-center gap-8">
           <div className="flex items-center gap-2">
             <div className="text-[9px] text-[#8E9299] uppercase font-bold">Engine Load</div>
             <div className="w-20 h-1 bg-white/10 rounded-full overflow-hidden">
               <div className="h-full bg-white w-[34%]"></div>
             </div>
           </div>
           <div className="text-[10px] font-mono text-[#444] uppercase tracking-tighter">
             Quantum Strategy Labs // Sector 7 Node
           </div>
        </div>
      </footer>
    </div>

  );
}
