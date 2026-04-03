import React from 'react';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';

const About: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <NavBar />
      <main className="flex-1 pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
            The Science Behind Your Watering Recommendation
          </h1>

          {/* Amber callout */}
          <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-6 mb-12">
            <p className="text-sm text-amber-900 leading-relaxed">
              Every weather model in the world will give you slightly different numbers. That's normal — and it's not what matters most. What matters is <strong>correct directionality</strong>: is your lawn trending toward a deficit or toward saturation? A recommendation off by a fraction of an inch still gives you the right answer — water today or skip it. That's what we optimize for.
            </p>
          </div>

          {/* Section 1 */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-foreground mb-4">Why weather data alone isn't enough</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Most people think watering a lawn is simple: it hasn't rained, so water. But that misses half the picture. Even on sunny days with no rain in the forecast, your soil loses moisture through a process called <em>evapotranspiration</em> — water leaving the ground through soil evaporation and through the grass blades themselves. On a hot, windy summer afternoon, that loss can be significant.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The flip side is also true. A little rain today and more forecast for Thursday might mean your lawn is perfectly covered for the week — even if the last time you watered was five days ago. Watering now would be waste.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              ThirstyGrass accounts for both sides of the equation: what's come in (rain) and what's going out (evaporation). The result is a <strong>water deficit calculation</strong> that drives every recommendation we make.
            </p>
          </section>

          {/* Section 2 — Deficit Formula */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-foreground mb-4">The deficit formula</h2>
            <div className="bg-muted rounded-lg p-5 font-mono text-sm leading-relaxed mb-6 overflow-x-auto">
              <pre className="text-foreground">{`adjustedTarget = etLoss7d × grassMultiplier
  // Cool-Season: ×1.25  |  Warm-Season: ×0.75  |  Mixed: ×1.0

// Soil saturation guard (evaluated first):
// if rain (past 3 days) > 0.5 in → SKIP regardless of deficit

deficit = adjustedTarget − rain (past 5 days) − forecast (5 days)

// deficit > 0.25 in  →  WATER
// deficit 0.05–0.25  →  MONITOR
// deficit < 0.05     →  SKIP`}</pre>
            </div>

            <div className="flex flex-wrap gap-3 mb-6">
              <Badge className="bg-red-600 text-white hover:bg-red-700 text-sm px-3 py-1">
                WATER — Your lawn is in deficit. Time to irrigate.
              </Badge>
              <Badge className="bg-amber-600 text-white hover:bg-amber-700 text-sm px-3 py-1">
                MONITOR — Borderline. Check again tomorrow.
              </Badge>
              <Badge className="bg-green-600 text-white hover:bg-green-700 text-sm px-3 py-1">
                SKIP — Rain has you covered. Save the water.
              </Badge>
            </div>

            <p className="text-muted-foreground leading-relaxed">
              We deliberately chose three states instead of two because the borderline case is genuinely uncertain. When conditions are close, we'd rather tell you to watch than push you toward an unnecessary watering cycle.
            </p>
          </section>

          {/* How the recommendation works — step by step */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-foreground mb-6">How your recommendation is calculated</h2>

            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Step 1: How thirsty is your specific lawn?</h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We start with how much water evaporated from the ground this week (that's etLoss7d — basically how hard the sun and wind have been working). Then we adjust it for your grass type:
                </p>
                <ul className="list-disc pl-6 space-y-1 text-muted-foreground leading-relaxed mb-3">
                  <li><strong>Cool-season grass</strong> (fescue, bluegrass) needs more water, so we multiply by 1.25</li>
                  <li><strong>Warm-season grass</strong> (bermuda, zoysia) is more drought-tolerant, so we multiply by 0.75</li>
                  <li><strong>Mixed/unknown</strong> stays as-is</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed">
                  This gives us your lawn's actual water target for the week.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Step 2: Soil saturation check (evaluated first, overrides everything)</h3>
                <p className="text-muted-foreground leading-relaxed">
                  If it rained more than half an inch in the last 3 days, we say <strong>SKIP</strong> immediately — no further math needed. The ground is still wet enough that watering would be wasteful regardless of anything else.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Step 3: Calculate the deficit</h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  Take your lawn's water target, then subtract:
                </p>
                <ul className="list-disc pl-6 space-y-1 text-muted-foreground leading-relaxed mb-3">
                  <li>Rain that already fell in the past 5 days</li>
                  <li>Rain that's forecast to fall in the next 5 days</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed">
                  The result is how "short" your lawn is on water — the deficit.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Step 4: Make the call</h3>
                <ul className="list-disc pl-6 space-y-1 text-muted-foreground leading-relaxed">
                  <li>If the deficit is more than <strong>0.25 inches</strong> → <strong>WATER</strong> (meaningfully behind, act now)</li>
                  <li>If it's between <strong>0.05 and 0.25</strong> → <strong>MONITOR</strong> (borderline, check tomorrow)</li>
                  <li>If it's below <strong>0.05</strong> → <strong>SKIP</strong> (rain has covered it)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 3 — Open-Meteo */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-foreground mb-4">Our weather data source: Open-Meteo</h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              ThirstyGrass pulls all weather data from <strong>Open-Meteo</strong>, a high-resolution weather API built on data from national weather services including NOAA, the European Centre for Medium-Range Weather Forecasts (ECMWF), Météo-France, and Canada's Meteorological Centre. It's the same underlying science behind the forecasts you'd get from those institutions — delivered at up to 1–2 km resolution across the United States.
            </p>

            <Card className="mb-6">
              <CardContent className="p-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'Resolution (US)', value: '1–2 km (local models)' },
                  { label: 'Forecast Range', value: 'Up to 16 days' },
                  { label: 'Historical Data', value: '80+ years of archive' },
                  { label: 'Model Updates', value: 'Hourly (US & Europe)' },
                  { label: 'ET₀ Support', value: '✓ Native FAO-56 Penman-Monteith' },
                  { label: 'Underlying Sources', value: 'NOAA, ECMWF, Météo-France, CMC' },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{item.label}</p>
                    <p className="text-sm font-semibold text-foreground mt-1">{item.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <p className="text-muted-foreground leading-relaxed mb-6">
              We chose Open-Meteo because it natively computes ET₀ — reference evapotranspiration — using the FAO-56 Penman-Monteith method. This is the gold standard formula recommended by the UN Food and Agriculture Organization for irrigation scheduling worldwide. It combines temperature, wind speed, humidity, and solar radiation into a single daily number representing how much water a well-watered grass surface loses to the atmosphere. Most weather APIs don't provide this. Open-Meteo gives it to us directly. Models also update every hour, so a storm that rolls through at noon is reflected in your recommendation by early afternoon.
            </p>

            {/* Comparison table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-3 font-semibold text-foreground">Provider</th>
                    <th className="text-left py-3 px-3 font-semibold text-foreground">ET₀ Native</th>
                    <th className="text-left py-3 px-3 font-semibold text-foreground">US Resolution</th>
                    <th className="text-left py-3 px-3 font-semibold text-foreground">Forecast Range</th>
                    <th className="text-left py-3 px-3 font-semibold text-foreground">Historical Depth</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'Open-Meteo ★', et: '✓ FAO-56', res: '1–2 km', forecast: '16 days', history: '80+ years', highlight: true },
                    { name: 'OpenWeatherMap', et: '✗', res: '~10 km', forecast: '5 days', history: 'Limited', highlight: false },
                    { name: 'Visual Crossing', et: '✗', res: '~5 km', forecast: '15 days', history: 'Extensive', highlight: false },
                    { name: 'Tomorrow.io', et: '✗', res: 'Hyperlocal', forecast: '14 days', history: 'Limited', highlight: false },
                    { name: 'NWS (Gov)', et: '✗', res: 'Variable', forecast: '7 days', history: 'Extensive', highlight: false },
                  ].map((row) => (
                    <tr key={row.name} className={`border-b border-border ${row.highlight ? 'bg-green-50' : ''}`}>
                      <td className="py-3 px-3 font-medium text-foreground">{row.name}</td>
                      <td className="py-3 px-3 text-muted-foreground">{row.et}</td>
                      <td className="py-3 px-3 text-muted-foreground">{row.res}</td>
                      <td className="py-3 px-3 text-muted-foreground">{row.forecast}</td>
                      <td className="py-3 px-3 text-muted-foreground">{row.history}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 4 — Directionality */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-foreground mb-4">Why "correct directionality" beats precision</h2>
            <blockquote className="border-l-4 border-primary pl-4 py-2 mb-6">
              <p className="text-lg italic text-muted-foreground">
                "No weather model is perfectly accurate. But for your lawn, you don't need perfection — you need to know which way the needle is pointing."
              </p>
            </blockquote>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Here's a concrete example. Suppose two different models calculate your deficit as 0.6 inches and 0.4 inches respectively. One says WATER, the other says MONITOR. That's a real difference in output — but both are telling you the same thing: your lawn is borderline and trending toward needing water soon. The actionable guidance is the same either way.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Our three-state output is deliberately designed around this reality. The MONITOR state exists precisely because the borderline zone deserves honest uncertainty rather than a false binary.
            </p>
          </section>

          {/* Section 5 — Local conditions */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-foreground mb-4">A note on local conditions</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Weather models work from ZIP code coordinates. They don't know if your yard is shaded by a large tree, sits on a south-facing slope, or has sandy soil that drains faster than typical. These microclimatic factors genuinely affect how much water your specific lawn needs.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Over time, you may notice your lawn consistently needs water a day earlier or later than the model suggests. We recommend adjusting your irrigation type and grass type settings if you find the model is consistently over- or under-estimating your actual conditions — those inputs shift the grass multiplier and help calibrate the deficit threshold to your lawn.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              The goal isn't a perfect model. It's a model that consistently points you in the right direction — and saves water in the process.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default About;
