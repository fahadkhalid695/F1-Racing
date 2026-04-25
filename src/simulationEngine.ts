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
  
  // Weather effect and tire matching
  if (weather === Weather.RAIN) {
    if (state.tireCompound !== TireCompound.WET) {
      // Massive penalty for dry tires in rain
      time += 15.0; 
    } else {
      // Wet tires are optimized for rain but still slower than slick dry pace
      time += 4.0;
    }
  } else if (weather === Weather.CLOUDY) {
    if (state.tireCompound === TireCompound.WET) {
      // Wets on dry/cloudy track are very slow and wear fast (simulated in wear logic)
      time += 8.0;
    }
    time += 0.5;
  } else { // SUNNY
    if (state.tireCompound === TireCompound.WET) {
      time += 12.0;
    }
  }
  
  // Tire wear effect (exponential degradation)
  const wear = Math.max(0, 100 - state.tireHealth);
  const wearPenalty = Math.pow(wear / 20, 1.5) * 0.1;
  time += wearPenalty;
  
  // Driver skill (faster drivers subtract from lap time)
  const skillBonus = (driver.skill / 100) * 1.5;
  time -= skillBonus;
  
  // Random variance (consistency)
  const varianceFactor = (100 - driver.consistency) / 100;
  const randomVariance = (Math.random() - 0.5) * 0.4 * varianceFactor;
  time += randomVariance;
  
  return time;
};

export const simulateLap = (prevState: RaceState): RaceState => {
  const nextLap = prevState.currentLap + 1;
  if (nextLap > prevState.totalLaps) return { ...prevState, isFinished: true };

  // 0. Dynamic Weather Transition
  let nextWeather = prevState.weather;
  const weatherRoll = Math.random();
  if (weatherRoll < 0.04) { // 4% chance of change
    if (nextWeather === Weather.SUNNY) nextWeather = Weather.CLOUDY;
    else if (nextWeather === Weather.CLOUDY) nextWeather = Math.random() > 0.5 ? Weather.RAIN : Weather.SUNNY;
    else if (nextWeather === Weather.RAIN) nextWeather = Weather.CLOUDY;
  }

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

    // Advanced pit strategy logic: pit if health < 30% OR weather mismatch
    const needsWet = nextWeather === Weather.RAIN;
    const hasWet = d.tireCompound === TireCompound.WET;
    const weatherMismatch = (needsWet && !hasWet) || (!needsWet && hasWet);

    if ((tireHealth < 25 || weatherMismatch) && status === 'RACING') {
      status = 'PIT_STOP';
      totalTime += PIT_STOP_LOSS;
      
      // Determine next tire
      if (needsWet) {
        tireCompound = TireCompound.WET;
      } else {
        // If it stopped raining, go to Mediums or whatever was next
        tireCompound = nextCompound(d.tireCompound === TireCompound.WET ? TireCompound.HARD : d.tireCompound);
      }
      
      tireAge = 0;
      tireHealth = 100;
      stops += 1;
    } else if (status === 'PIT_STOP') {
      status = 'RACING';
    }

    const lapTime = calculateLapTime(d, prevState.circuit, nextWeather);
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

  // 2. Resolve field positions and handle overtaking/dirty air
  const sortedByPrevPos = Object.values(updatedDrivers).sort((a, b) => a.position - b.position);
  const resolvedDrivers: DriverRaceState[] = [];
  
  // The leader always sets their own pace
  resolvedDrivers.push(sortedByPrevPos[0]);

  for (let i = 1; i < sortedByPrevPos.length; i++) {
    const attacker = sortedByPrevPos[i];
    const defender = resolvedDrivers[i - 1]; // The car currently in front of them
    
    const attackerInfo = DRIVERS.find(d => d.id === attacker.driverId)!;
    const defenderInfo = DRIVERS.find(d => d.id === defender.driverId)!;
    
    // Check if the attacker would naturally be ahead based on total time
    attacker.lastEvent = 'NONE';
    attacker.prevPosition = prevState.drivers[attacker.driverId].position;

    if (attacker.totalTime < defender.totalTime) {
      // Overtake Attempt
      const paceDelta = defender.lastLapTime - attacker.lastLapTime;
      const tireDelta = attacker.tireHealth - defender.tireHealth;
      
      let overtakeChance = (100 - prevState.circuit.overtakeDifficulty) / 150;
      overtakeChance += (paceDelta / 2);
      overtakeChance += (attackerInfo.aggression / 500);
      overtakeChance += (tireDelta / 200);
      
      overtakeChance -= (defenderInfo.consistency / 400);
      
      const roll = Math.random();
      const success = roll < overtakeChance;
      
      if (!success) {
        // FAILED OVERTAKE
        const buffer = 0.3 + (Math.random() * 0.4);
        attacker.totalTime = defender.totalTime + buffer;
        const prevTotal = prevState.drivers[attacker.driverId].totalTime;
        attacker.lastLapTime = attacker.totalTime - prevTotal;
        attacker.lastEvent = 'OVERTAKE_FAILED';
      } else {
        attacker.lastEvent = 'OVERTAKE_SUCCESS';
      }
    }
    resolvedDrivers.push(attacker);
  }

  // 3. Final classification and gap calculation
  const sortedFinal = resolvedDrivers.sort((a, b) => a.totalTime - b.totalTime);
  const leaderTime = sortedFinal[0].totalTime;

  sortedFinal.forEach((d, idx) => {
    d.position = idx + 1;
    if (prevState.drivers[d.driverId].status === 'PIT_STOP') d.lastEvent = 'PIT_STOP';
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
    isFinished: nextLap === prevState.totalLaps,
    weather: nextWeather
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
      prevPosition: idx + 1,
      totalTime: 0,
      lastLapTime: 0,
      bestLapTime: 0,
      tireCompound: TireCompound.MEDIUM,
      tireAge: 0,
      tireHealth: 100,
      stops: 0,
      currentGap: 0,
      status: 'RACING',
      lastEvent: 'NONE'
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
