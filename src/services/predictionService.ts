import { RaceState, DriverRaceState } from '../types';
import { simulateLap } from '../simulationEngine';

export interface ProbabilityResult {
  driverId: string;
  probabilities: {
    podium: number;
    win: number;
    top5: number;
    top10: number;
  };
  expectedPosition: number;
}

/**
 * Runs a Monte Carlo simulation from the current race state to predict final outcomes.
 * @param currentState The current state of the race
 * @param iterations Number of simulations to run (e.g., 50-100 for browser performance)
 */
export function runMonteCarlo(currentState: RaceState, iterations: number = 50): ProbabilityResult[] {
  const driverPerformance: Record<string, { positions: number[], wins: number, podiums: number, top5: number, top10: number }> = {};
  
  // Initialize tracker
  Object.keys(currentState.drivers).forEach(id => {
    driverPerformance[id] = { positions: [], wins: 0, podiums: 0, top5: 0, top10: 0 };
  });

  for (let i = 0; i < iterations; i++) {
    let simState = { ...currentState };
    
    // Fast-forward to the end of the race
    while (!simState.isFinished) {
      simState = simulateLap(simState);
    }

    // Record results
    Object.values(simState.drivers).forEach(d => {
      const perf = driverPerformance[d.driverId];
      perf.positions.push(d.position);
      if (d.position === 1) perf.wins++;
      if (d.position <= 3) perf.podiums++;
      if (d.position <= 5) perf.top5++;
      if (d.position <= 10) perf.top10++;
    });
  }

  // Calculate final probabilities
  return Object.keys(driverPerformance).map(id => {
    const perf = driverPerformance[id];
    const totalPos = perf.positions.reduce((a, b) => a + b, 0);
    
    return {
      driverId: id,
      probabilities: {
        win: (perf.wins / iterations) * 100,
        podium: (perf.podiums / iterations) * 100,
        top5: (perf.top5 / iterations) * 100,
        top10: (perf.top10 / iterations) * 100,
      },
      expectedPosition: totalPos / iterations
    };
  }).sort((a, b) => a.expectedPosition - b.expectedPosition);
}
