# F1 Strategist: Pro Telemetry & AI Command Center

A high-fidelity Formula 1 race strategy simulator featuring real-time telemetry, AI-driven tactical insights, and Monte Carlo predictive modeling.

## 🚀 Key Features

### 1. Advanced Simulation Engine
- **Physics-Based Lap Times:** Calculations factor in tire compound (Soft, Medium, Hard, Wet), fuel load, tire degradation, and driver aggression.
- **Dynamic Weather System:** Real-time weather shifts (Sunny → Cloudy → Rain) that necessitate tactical pit stops for Wet tires.
- **Safety Car (SC) Logic:** Randomly triggered track incidents deploy the Safety Car, bunching the field within 1.2s gaps and neutralizing the race pace.

### 2. Predictive Analytics
- **Monte Carlo Forecasts:** Run 50 parallel race simulations from the current state to determine the statistical probability of a Win, Podium, or Top 10 finish.
- **What-If Projections:** Manually configure future pit stops (Lap and Compound) to see projected track position and gap deltas.
- **Lap Time Trends:** Recharts-powered telemetry view showing performance consistency and tire drop-off over the last 10 laps.

### 3. AI Strategy Core (Powered by Gemini)
- **Live Tactical Radio:** Real-time strategy recommendations based on track position, rival gaps, and current tire health.
- **Context-Aware Advice:** The AI specifically analyzes user-planned "What-If" scenarios to confirm if a strategy is optimal or needs adjustment.

### 4. Hardware-Level Telemetry
- **Live Data Stream:** Real-time monitoring of RPM, KM/H, and individual tire carcass temperatures.
- **Aggression Management:** Toggle between different drivers to see how their unique skill sets and aggression levels affect tire wear and overtake success.

## 🛠 Tech Stack
- **Framework:** React 18+ with Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Animations:** Motion (formerly Framer Motion)
- **Charts:** Recharts
- **AI:** Google Generative AI (Gemini Flash)

## 🏁 How to Use
1. **Initialize:** Select a circuit (Silverstone, Spa, Monaco, or Interlagos).
2. **Start Sim:** Click the "Live Sim" button to begin the race.
3. **Analyze:** Use the Monte Carlo engine to see if you're on track for a win.
4. **Strategize:** Use the "What-If" panel to plan your next pit stop and wait for the AI to approve the strategy.
5. **Monitor:** Watch the live telemetry to ensure tire temperatures don't exceed 110°C.
