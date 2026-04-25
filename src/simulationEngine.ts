/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DriverRaceState, RaceState, TireCompound, LapResult, Weather, Circuit } from './types';
import { DRIVERS, TIRES, PIT_STOP_LOSS } from './constants';

export const calculateLapTime = (
  state: DriverRaceState,
  circuit: Circuit,
  weather: Weather
): number => {
  const driver = DRIVERS.find(d => d.id === state.driverId)!;
  const tire = TIRES[state.tireCompound];
  
  // Base pace from circuit
  let time = circuit.baseLapTime;
  
  // Tire compound relative pace
  time += tire.basePace;
  
  // Tire wear effect (exponential degradation)
  const wear = Math.max(0, 100 - state.tireHealth);
  const wearPenalty = Math.pow(wear / 20, 1.5) * 0.1;
  time += wearPenalty;
  
  // Driver skill (faster drivers subtract from lap time)
  const skillBonus = (driver.skill / 100) * 1.5;
  time -= skillBonus;
  
  // Weather effect
  if (weather === Weather.RAIN) time += 4.0;
  if (weather === Weather.CLOUDY) time += 0.5;
  
  // Fuel burn (simplified: cars get lighter over race)
  // We'll assume a constant improvement of 0.03s per lap
  // We don't have currentLap here, so let's pass it or assume it's calculated elsewhere
  
  // Random variance (consistency)
  const varianceFactor = (100 - driver.consistency) / 100;
  const randomVariance = (Math.random() - 0.5) * 0.4 * varianceFactor;
  time += randomVariance;
  
  return time;
};

export const simulateLap = (prevState: RaceState): RaceState => {
  const nextLap = prevState.currentLap + 1;
  if (nextLap > prevState.totalLaps) return { ...prevState, isFinished: true };

  const updatedDrivers: Record<string, DriverRaceState> = {};
  const lapResults: LapResult[] = [];

  // 1. Calculate lap times and update tire health
  Object.values(prevState.drivers).forEach((d) => {
    const tire = TIRES[d.tireCompound];
    
    // Check if we should pit
    let status = d.status;
    let tireCompound = d.tireCompound;
    let tireAge = d.tireAge;
    let tireHealth = d.tireHealth;
    let totalTime = d.totalTime;
    let stops = d.stops;

    // Simple pit strategy logic: pit if health < 30%
    if (tireHealth < 30 && status === 'RACING') {
      status = 'PIT_STOP';
      totalTime += PIT_STOP_LOSS;
      tireCompound = nextCompound(d.tireCompound);
      tireAge = 0;
      tireHealth = 100;
      stops += 1;
    } else if (status === 'PIT_STOP') {
      status = 'RACING';
    }

    const lapTime = calculateLapTime(d, prevState.circuit, prevState.weather);
    const finalLapTime = (status === 'PIT_STOP') ? lapTime + (PIT_STOP_LOSS / 2) : lapTime; // splitting loss
    
    const newTotalTime = totalTime + finalLapTime;
    const newTireAge = tireAge + 1;
    const newTireHealth = Math.max(0, tireHealth - (tire.degradationRate * prevState.circuit.tireWearFactor * (1 + (DRIVERS.find(dr => dr.id === d.driverId)!?.aggression / 200))));

    updatedDrivers[d.driverId] = {
      ...d,
      totalTime: newTotalTime,
      lastLapTime: finalLapTime,
      bestLapTime: d.bestLapTime === 0 ? finalLapTime : Math.min(d.bestLapTime, finalLapTime),
      tireAge: newTireAge,
      tireHealth: newTireHealth,
      tireCompound: tireCompound,
      status: status === 'PIT_STOP' ? 'RACING' : status, // reset status for next lap calculation
      stops: stops
    };
  });

  // 2. Sort by total time to get positions
  const sortedDrivers = Object.values(updatedDrivers).sort((a, b) => a.totalTime - b.totalTime);
  const leaderTime = sortedDrivers[0].totalTime;

  sortedDrivers.forEach((d, idx) => {
    d.position = idx + 1;
    d.currentGap = d.totalTime - leaderTime;
    
    lapResults.push({
      lap: nextLap,
      driverId: d.driverId,
      lapTime: d.lastLapTime,
      position: d.position,
      gapToLeader: d.currentGap,
      tireCompound: d.tireCompound,
      tireAge: d.tireAge,
      status: d.status
    });
  });

  return {
    ...prevState,
    currentLap: nextLap,
    drivers: updatedDrivers,
    history: [...prevState.history, ...lapResults],
    isFinished: nextLap === prevState.totalLaps
  };
};

const nextCompound = (current: TireCompound): TireCompound => {
  if (current === TireCompound.SOFT) return TireCompound.MEDIUM;
  if (current === TireCompound.MEDIUM) return TireCompound.HARD;
  return TireCompound.MEDIUM; // Cycle back or pickHard
};

export const initializeRace = (circuit: Circuit): RaceState => {
  const drivers: Record<string, DriverRaceState> = {};
  
  DRIVERS.forEach((d, idx) => {
    drivers[d.id] = {
      driverId: d.id,
      position: idx + 1,
      totalTime: 0,
      lastLapTime: 0,
      bestLapTime: 0,
      tireCompound: TireCompound.MEDIUM,
      tireAge: 0,
      tireHealth: 100,
      stops: 0,
      currentGap: 0,
      status: 'RACING'
    };
  });

  return {
    currentLap: 0,
    totalLaps: circuit.laps,
    circuit: circuit,
    drivers: drivers,
    isFinished: false,
    weather: Weather.SUNNY,
    safetyCar: false,
    history: []
  };
};
