/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { RaceState, DriverRaceState } from './types';
import { DRIVERS } from './constants';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getStrategyInsight(state: RaceState, targetDriverId: string): Promise<string> {
  const driverState = state.drivers[targetDriverId];
  const driverInfo = DRIVERS.find(d => d.id === targetDriverId);
  const circuit = state.circuit;

  if (!driverState || !driverInfo) return "Insufficient data.";

  const prompt = `
    You are an elite F1 Race Engineer. Analyze the current race situation and give a concise, professional recommendation to your driver.
    
    Race Context:
    - Circuit: ${circuit.name} (${state.currentLap}/${state.totalLaps} laps)
    - Weather: ${state.weather}
    - Safety Car: ${state.safetyCar ? 'ACTIVE' : 'NONE'}
    
    Driver Status (${driverInfo.name}):
    - Position: P${driverState.position}
    - Gap to Leader: +${driverState.currentGap.toFixed(3)}s
    - Tires: ${driverState.tireCompound} (${driverState.tireAge} laps old)
    - Tire Health: ${driverState.tireHealth.toFixed(1)}%
    - Stops: ${driverState.stops}
    
    Current Field:
    ${Object.values(state.drivers)
      .sort((a, b) => a.position - b.position)
      .map(d => `P${d.position}: ${DRIVERS.find(dr => dr.id === d.driverId)?.shortName} - Gap: +${d.currentGap.toFixed(1)}s - Tires: ${d.tireCompound}`)
      .join('\n')}
      
    Provide a "Radio Transmision" style recommendation. Should we pit? Should we push? Is there an undercut opportunity? Be specific and immersive. Keep it under 60 words.
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
