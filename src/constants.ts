/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Driver, Circuit, TireCompound, TireData } from './types';

export const DRIVERS: Driver[] = [
  { id: '1', name: 'Max Verstappen', team: 'Red Bull', skill: 98, aggression: 90, consistency: 95, shortName: 'VER', color: '#1E41FF' },
  { id: '2', name: 'Lando Norris', team: 'McLaren', skill: 94, aggression: 82, consistency: 88, shortName: 'NOR', color: '#FF8700' },
  { id: '3', name: 'Lewis Hamilton', team: 'Ferrari', skill: 96, aggression: 85, consistency: 92, shortName: 'HAM', color: '#E80020' },
  { id: '4', name: 'Charles Leclerc', team: 'Ferrari', skill: 95, aggression: 88, consistency: 85, shortName: 'LEC', color: '#E80020' },
  { id: '5', name: 'George Russell', team: 'Mercedes', skill: 92, aggression: 80, consistency: 87, shortName: 'RUS', color: '#27F4D2' },
  { id: '6', name: 'Oscar Piastri', team: 'McLaren', skill: 91, aggression: 78, consistency: 90, shortName: 'PIA', color: '#FF8700' },
  { id: '7', name: 'Carlos Sainz', team: 'Williams', skill: 91, aggression: 75, consistency: 93, shortName: 'SAI', color: '#005AFF' },
  { id: '8', name: 'Fernando Alonso', team: 'Aston Martin', skill: 93, aggression: 85, consistency: 94, shortName: 'ALO', color: '#229971' },
  { id: '9', name: 'Sergio Perez', team: 'Red Bull', skill: 85, aggression: 70, consistency: 75, shortName: 'PER', color: '#1E41FF' },
  { id: '10', name: 'Kimi Antonelli', team: 'Mercedes', skill: 82, aggression: 85, consistency: 70, shortName: 'ANT', color: '#27F4D2' },
  // ... adding more if needed, but 10 is enough for a demo
];

export const CIRCUITS: Circuit[] = [
  { id: 'monaco', name: 'Silverstone', location: 'United Kingdom', laps: 52, baseLapTime: 87.0, tireWearFactor: 1.2, overtakeDifficulty: 60, safetyCarChance: 0.03 },
  { id: 'spa', name: 'Spa-Francorchamps', location: 'Belgium', laps: 44, baseLapTime: 104.0, tireWearFactor: 1.5, overtakeDifficulty: 40, safetyCarChance: 0.05 },
  { id: 'monaco_real', name: 'Monaco', location: 'Monaco', laps: 78, baseLapTime: 71.0, tireWearFactor: 0.8, overtakeDifficulty: 95, safetyCarChance: 0.06 },
  { id: 'interlagos', name: 'Interlagos', location: 'Brazil', laps: 71, baseLapTime: 68.0, tireWearFactor: 1.1, overtakeDifficulty: 45, safetyCarChance: 0.04 },
];

export const TIRES: Record<TireCompound, TireData> = {
  [TireCompound.SOFT]: { compound: TireCompound.SOFT, grip: 1.0, degradationRate: 2.5, basePace: -1.0 },
  [TireCompound.MEDIUM]: { compound: TireCompound.MEDIUM, grip: 0.95, degradationRate: 1.2, basePace: 0.0 },
  [TireCompound.HARD]: { compound: TireCompound.HARD, grip: 0.9, degradationRate: 0.6, basePace: 0.8 },
  [TireCompound.WET]: { compound: TireCompound.WET, grip: 0.7, degradationRate: 0.4, basePace: 6.0 },
};

export const PIT_STOP_LOSS = 22.0; // seconds lost in pits
