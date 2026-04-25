/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { RaceState, DriverRaceState, TireCompound } from './types';
import { DRIVERS, TIRES, PIT_STOP_LOSS } from './constants';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getStrategyInsight(
  state: RaceState, 
  targetDriverId: string,
  plannedLap?: number,
  plannedCompound?: TireCompound
): Promise<string> {
  const driverState = state.drivers[targetDriverId];
  const driverInfo = DRIVERS.find(d => d.id === targetDriverId);
  const circuit = state.circuit;

  if (!driverState || !driverInfo) return "Insufficient data.";

  const prompt = `
    You are an elite F1 Race Engineer. Analyze the current race situation and give a concise, professional recommendation to your driver.
    
    Race Metadata:
    - Circuit: ${circuit.name} (${state.currentLap}/${state.totalLaps} laps)
    - Weather: ${state.weather}
    - Safety Car: ${state.safetyCar ? 'ACTIVE' : 'NONE'}
    - Pit Stop Delta: ~${PIT_STOP_LOSS}s loss
    
    Tire Data:
    - Soft: +${TIRES.SOFT.basePace}s pace, high wear
    - Medium: Reference pace, avg wear
    - Hard: +${TIRES.HARD.basePace}s pace, low wear
    
    Driver Status (${driverInfo.name}):
    - Position: P${driverState.position}
    - Gap to Leader: +${driverState.currentGap.toFixed(3)}s
    - Last Lap: ${driverState.lastLapTime.toFixed(3)}s
    - Tires: ${driverState.tireCompound} (${driverState.tireAge} laps old)
    - Tire Health: ${driverState.tireHealth.toFixed(1)}%
    
    ${plannedLap && plannedCompound ? `
    USER PREFERENCE / PLANNED STRATEGY:
    - Planned Pit Lap: ${plannedLap}
    - Target Tire Compound: ${plannedCompound}
    ` : ''}

    Nearby Opponents:
    ${Object.values(state.drivers)
      .sort((a, b) => a.position - b.position)
      .filter(d => Math.abs(d.position - driverState.position) <= 2 && d.driverId !== targetDriverId)
      .map(d => `P${d.position}: ${DRIVERS.find(dr => dr.id === d.driverId)?.shortName} (Gap: ${d.currentGap.toFixed(1)}s, Tires: ${d.tireCompound} L${d.tireAge})`)
      .join('\n')}
      
    Task:
    Provide a "Radio Transmission" style recommendation. 
    Analyze if an UNDERCUT (pitting early to gain track position via fresh tires) or OVERCUT (staying out longer to gain position while others are in traffic/slower) is viable.
    ${plannedLap ? `Specifically, comment on if the planned pit message for Lap ${plannedLap} onto ${plannedCompound} is optimal or if we should adjust.` : ''}
    Consider the ${PIT_STOP_LOSS}s pit loss.
    Be specific, immersive, and professional. Keep it under 60 words.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "No response from engineering.";
  } catch (error) {
    console.error("AI Strategy Error:", error);
    return "Connection lost with pit wall.";
  }
}

export async function getWhatIfProjection(
  state: RaceState, 
  targetDriverId: string, 
  targetLap: number, 
  targetCompound: TireCompound
): Promise<string> {
  const driverState = state.drivers[targetDriverId];
  const driverInfo = DRIVERS.find(d => d.id === targetDriverId);

  if (!driverState || !driverInfo) return "No data.";

  const prompt = `
    You are an elite F1 Strategist. A "What-If" scenario has been proposed.
    
    Current Sitation:
    - Driver: ${driverInfo.name} (P${driverState.position})
    - Current Lap: ${state.currentLap} / ${state.totalLaps}
    - Current Tires: ${driverState.tireCompound} (Age: ${driverState.tireAge})
    - Weather: ${state.weather}
    
    Proposed Strategy Change:
    - Pit on Lap: ${targetLap}
    - Switch to Compound: ${targetCompound}
    
    Field Context:
    Leader is P1, ${driverState.currentGap.toFixed(1)}s ahead.
    Pit stop loss is ${PIT_STOP_LOSS}s.
    
    Predict the outcome of this strategy. Will they lose track position? Can they recover it with fresh tires? Compare the "Estimated Finish Position" vs current. 
    Be professional, data-driven, and concise (under 60 words).
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "Projection unavailable.";
  } catch (error) {
    return "Sim process failed.";
  }
}
