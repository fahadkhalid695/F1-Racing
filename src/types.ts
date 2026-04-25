/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Driver {
  id: string;
  name: string;
  team: string;
  skill: number; // 0-100
  aggression: number; // 0-100
  consistency: number; // 0-100
  shortName: string;
  color: string;
}

export interface Circuit {
  id: string;
  name: string;
  location: string;
  laps: number;
  baseLapTime: number; // in seconds
  tireWearFactor: number; // multiplier
  overtakeDifficulty: number; // 0-100
}

export enum TireCompound {
  SOFT = 'SOFT',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

export interface TireData {
  compound: TireCompound;
  grip: number; // 0-1.0
  degradationRate: number; // per lap
  basePace: number; // seconds relative to reference
}

export interface LapResult {
  lap: number;
  driverId: string;
  lapTime: number;
  position: number;
  gapToLeader: number;
  tireCompound: TireCompound;
  tireAge: number;
  status: 'RACING' | 'PIT_STOP' | 'OUT';
}

export interface RaceState {
  currentLap: number;
  totalLaps: number;
  circuit: Circuit;
  drivers: Record<string, DriverRaceState>;
  isFinished: boolean;
  weather: Weather;
  safetyCar: boolean;
  history: LapResult[];
}

export interface DriverRaceState {
  driverId: string;
  position: number;
  totalTime: number;
  lastLapTime: number;
  bestLapTime: number;
  tireCompound: TireCompound;
  tireAge: number;
  tireHealth: number; // 0-100
  stops: number;
  currentGap: number;
  status: 'RACING' | 'PIT_STOP' | 'OUT';
  strategyRecommendation?: string;
}

export enum Weather {
  SUNNY = 'SUNNY',
  CLOUDY = 'CLOUDY',
  RAIN = 'RAIN'
}
