// Extracted verbatim from MedartisBrandGenerator.jsx — the monolith is a
// documented debt; sections leave it one at a time, behavior unchanged.
import { useState, useEffect, useCallback } from 'react';
import { BRAND, Section, imgToDataUrl } from './uiKit.jsx';

// ── Generative AI (local ComfyUI) ────────────────────────────────────
// The user never reaches the model directly: the server compiles the house look,
// the realism block and the negative around the subject. See vite-plugin-genai.js.
//
// The negative-prompt honesty problem, surfaced in the UI:
// FLUX.1 [dev] is guidance-distilled — its graph runs a BasicGuider, which has no
// negative input at all, so a negative prompt is IGNORED, not merely weakened.
// "Strict negatives" swaps in a CFGGuider to give the sampler a real negative
// branch (~2× slower). SDXL / Turbo always honour it. We report what actually
// happened rather than implying the negative did something it didn't.
const GenerateSection = ({
  sectionProps = {}, format, surface, onPickImage, onSaveToLibrary,
  makeControlMap, library = [], currentImage = null, secNo = {},
}) => {
  const [status, setStatus] = useState(null);
  // ── CONDITIONING ────────────────────────────────────────────────
  // refImage  : "look like THIS"    (IP-Adapter → the MODEL branch)
  // ctrlImage : "compose like THIS" (ControlNet → the CONDITIONING branch)
  const [refImage, setRefImage] = useState(null);
  const [refStrength, setRefStrength] = useState(0.65);
  const [ctrlImage, setCtrlImage] = useState(null);
  const [ctrlSource, setCtrlSource] = useState('layout');   // 'layout' | 'photo'
  const [ctrlType, setCtrlType] = useState('depth');
  const [ctrlStrength, setCtrlStrength] = useState(0.55);
  const [prompt, setPrompt] = useState('');
  const [extraNegative, setExtraNegative] = useState('');
  const [realism, setRealism] = useState(true);
  const [strictNegative, setStrictNegative] = useState(false);
  const [engine, setEngine] = useState('flux');
  const [ckpt, setCkpt] = useState('');   // '' = let the server pick
  const [fast, setFast] = useState(false);  // Lightning / LCM LoRA on top of the checkpoint
  const [draftFirst, setDraftFirst] = useState(true);   // half-res same-seed draft in seconds
  const [refine, setRefine] = useState(false);          // latent hi-res second pass (print)
  const [lockSeed, setLockSeed] = useState(false);      // reuse the last seed (iterate on one image)
  const [steps, setSteps] = useState(null);             // null = the engine's own default
  const [batch, setBatch] = useState(1);                // outputs per run (1 / 2 / 4 / 6)
  const [detail, setDetail] = useState(null);           // the result whose provenance is open (IBRA pattern)
  const [strength, setStrength] = useState(0.85);       // house-LoRA strength (engines that carry one)
  const [lastSeed, setLastSeed] = useState(null);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);
  const [blockedTerm, setBlockedTerm] = useState(null);
  const [results, setResults] = useState([]);
  const [lastMeta, setLastMeta] = useState(null);

  // Prefer an engine whose output can actually be published. Z-Image Turbo
  // (Apache-2.0) beats SDXL on both photorealism and speed on a Mac, so it wins
  // when installed; SDXL remains the conditioning engine.
  useEffect(() => {
    if (status?.engines?.includes('zimage')) setEngine((e) => (e === 'flux' || e === 'sdxl' ? 'zimage' : e));
    else if (status?.engines?.includes('sdxl')) setEngine((e) => (e === 'flux' ? 'sdxl' : e));
  }, [status?.engines?.join(',')]);

  // Refine defaults ON for print formats — that is where the resolution matters.
  useEffect(() => { setRefine(!!format?.printable); }, [format?.key]);

  // The checkpoint is the single biggest lever on realism — bigger than any
  // prompt wording. If a photoreal fine-tune is installed, start there rather
  // than on stock SDXL base, which is what the prompt would otherwise be fighting.
  useEffect(() => {
    const list = status?.sdxlCkpts || [];
    if (!list.length) return;
    setCkpt((c) => (c && list.includes(c) ? c : (status?.photorealCkpts?.[0] || '')));
  }, [status?.sdxlCkpts?.join(','), status?.photorealCkpts?.join(',')]);

  // Wall-clock ticker — a bar with no numbers is indistinguishable from a hang.
  useEffect(() => {
    if (!busy) { setElapsed(0); return; }
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 250);
    return () => clearInterval(id);
  }, [busy]);

  const probe = useCallback(() => fetch('/api/gen/status')
    .then((r) => r.json())
    .then(setStatus)
    .catch(() => setStatus({ providers: [], comfyError: 'Generative plugin not reachable.' })), []);
  useEffect(() => { probe(); }, [probe]);

  // ComfyUI may be booted after the app — keep looking instead of latching "absent".
  const local = status?.providers?.includes('local');
  useEffect(() => {
    if (local) return;
    const id = setInterval(probe, 5000);
    return () => clearInterval(id);
  }, [local, probe]);

  const poll = async (id) => {
    for (;;) {
      await new Promise((r) => setTimeout(r, 700));
      const j = await fetch(`/api/gen/job/${id}`).then((r) => r.json()).catch(() => null);
      if (!j) continue;
      setJob(j);
      if (j.status === 'done') return j;
      if (j.status === 'error') throw new Error(j.error || 'Generation failed.');
    }
  };

  const generate = async () => {
    setBusy(true); setError(null); setBlockedTerm(null); setJob({ status: 'queued', progress: 0 });
    try {
      const r = await fetch('/api/gen/image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt, surface, engine, realism, strictNegative, extraNegative,
          ckpt: engine === 'sdxl' ? (ckpt || undefined) : undefined,
          fast: engine === 'sdxl' ? fast : false,
          draft: draftFirst,
          refine,
          steps: steps ?? undefined,
          batch,
          strength,
          seed: lockSeed && Number.isFinite(lastSeed) ? lastSeed : undefined,
          w: format.w, h: format.h,
          // Conditioning. The server reports back what it could actually honour.
          refImage: canCondition && refImage ? refImage : null,
          refStrength,
          controlImage: canCondition && ctrlImage ? ctrlImage : null,
          controlType: ctrlType,
          controlStrength: ctrlStrength,
          // Hold the composition through the early steps, then LET GO. A control
          // that runs to the end of the denoise doesn't just place the subject —
          // it keeps overruling the detail pass, and the image comes out flat.
          controlEndAt: ctrlSource === 'layout' ? 0.55 : 0.85,
          // A map WE synthesized from the layout is already a control map —
          // running a depth estimator over it would estimate the depth of a
          // diagram. Only a photographic source gets preprocessed.
          controlPreprocess: ctrlSource === 'photo',
        }),
      });
      const sub = await r.json();
      if (!r.ok) {
        // The server names the exact term that tripped the gate. Throwing it away
        // turns a precise refusal into a riddle — the user then has to guess which
        // of twelve innocent-looking words was the problem.
        if (sub.term) setBlockedTerm(sub.term);
        throw new Error(sub.error || 'Request rejected.');
      }
      setJobId(sub.jobId);
      if (Number.isFinite(sub.seed)) setLastSeed(sub.seed);
      const done = await poll(sub.jobId);
      setLastMeta(done);
      // Auto-keep EVERYTHING the run produced — final AND draft — each with the
      // prompt, seed and engine that made it. A draft that looked great must
      // never be lost to the final that replaced it.
      const stamp = (src, extra = {}) => ({
        src, prompt, seed: sub.seed, engine, savedAt: Date.now(), ...extra,
      });
      const produced = [
        ...(done.images || []).map((src) => stamp(src)),
        ...(done.draftImages || []).map((src) => stamp(src, { draft: true })),
      ];
      setResults(produced.concat(results).slice(0, 12));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false); setJob(null); setJobId(null);
    }
  };

  const cancel = () => { if (jobId) fetch(`/api/gen/cancel/${jobId}`, { method: 'POST' }).catch(() => {}); };

  // Per-tile REFINE (ported from the IBRA generator): img2img on Z-Image at
  // partial denoise — keeps the tile's composition, re-renders the detail.
  const [refining, setRefining] = useState(null);
  const refineResult = async (entry, i) => {
    if (refining !== null || !status?.zimage) return;
    setRefining(i);
    try {
      const r = await fetch('/api/gen/refine', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: entry.src, prompt: entry.prompt || prompt, surface, seed: entry.seed }),
      });
      const sub = await r.json();
      if (!r.ok) throw new Error(sub.error || 'Refine rejected.');
      const done = await poll(sub.jobId);
      const out = (done.images || [])[0];
      if (out) setResults((rs) => [{ ...entry, src: out, refined: true, draft: false, seed: sub.seed }, ...rs].slice(0, 12));
    } catch (e) {
      setError(e.message);
    } finally {
      setRefining(null);
    }
  };

  // Manual upscale for any produced image: ESRGAN + lanczos on the server, the
  // result lands in the grid next to its source.
  const [upscaling, setUpscaling] = useState(null);
  const upscaleResult = async (entry, i) => {
    if (upscaling !== null) return;
    setUpscaling(i);
    try {
      const r = await fetch('/api/gen/upscale', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: entry.src, w: format.w, h: format.h }),
      });
      const sub = await r.json();
      if (!r.ok) throw new Error(sub.error || 'Upscale rejected.');
      const done = await poll(sub.jobId);
      const up = (done.images || [])[0];
      if (up) setResults((rs) => [{ ...entry, src: up, upscaled: true, draft: false }, ...rs].slice(0, 12));
    } catch (e) {
      setError(e.message);
    } finally {
      setUpscaling(null);
    }
  };

  // Will the negative actually reach the sampler with the current choices?
  const negWorks = engine === 'flux' ? strictNegative : engine !== 'zimage';

  // Conditioning is SDXL-only: Flux ControlNet/IP-Adapter weights are tied to a
  // specific checkpoint, so offering them on Flux would only move the failure
  // into ComfyUI's validator. Say that plainly rather than let the control lie.
  const isSdxl = engine === 'sdxl' || engine === 'sdxl-turbo';
  const canIp      = isSdxl && !!status?.conditioning?.ip;
  const canControl = isSdxl && !!status?.conditioning?.control;
  const canCondition = canIp || canControl;
  const controlTypes = status?.conditioning?.controlTypes || [];
  // A LAYOUT MAP IS A DEPTH STATEMENT, NOT AN EDGE STATEMENT.
  // This is the correction to my own first design. A canny/scribble net expects
  // DENSE edge structure and reproduces what it is given; a map derived from a
  // bare layout has almost no edges in it, so the net reads "no structure
  // anywhere" and returns a flat, empty, distant scene — and any rectangle drawn
  // into the map comes back as a literal rectangle in the picture.
  //
  // What the layout actually knows is: "this region must stay EMPTY and FAR,
  // because type is going on top of it, and the picture belongs over HERE."
  // That is depth. So from-the-layout offers depth only. Edges come from a photo
  // (or, later, from a hand sketch), where there is real structure to trace.
  const layoutKinds = ['depth'].filter((k) => controlTypes.includes(k));
  useEffect(() => {
    if (ctrlSource === 'layout' && layoutKinds.length && !layoutKinds.includes(ctrlType)) {
      setCtrlType(layoutKinds[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctrlSource, layoutKinds.join(',')]);

  useEffect(() => {
    if (controlTypes.length && !controlTypes.includes(ctrlType)) setCtrlType(controlTypes[0]);
  }, [controlTypes.join(','), ctrlType]);

  const refreshLayoutMap = () => {
    const map = makeControlMap?.(ctrlType);
    if (!map) {
      setError('The layout leaves no room to compose in — free up some space, then rebuild the map.');
      return;
    }
    setError(null);
    setCtrlImage(map);
  };
  // Keep the map in step with the type; a depth map fed to a canny net is noise.
  useEffect(() => {
    if (ctrlSource === 'layout' && ctrlImage) refreshLayoutMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctrlType]);

  const readFileAsDataUrl = async (file, set) => {
    try { set(await fileToImageDataUrl(file)); } catch (e) { setError(e.message); }
  };

  const btn = (on) => ({
    padding: '6px 4px', cursor: 'pointer', borderRadius: 0,
    background: on ? BRAND.ink : BRAND.paper, color: on ? BRAND.bone00 : BRAND.ink600,
    border: `1px solid ${on ? BRAND.ink : BRAND.ink100}`,
    fontFamily: BRAND.mono, fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase',
  });

  return (
    <Section {...sectionProps}>
      <div style={{
        padding: '9px 10px', marginBottom: 10, background: BRAND.bone,
        borderLeft: `3px solid ${BRAND.gold}`,
        fontFamily: BRAND.mono, fontSize: 9, color: BRAND.ink600,
        letterSpacing: '0.04em', lineHeight: 1.6,
      }}>
        FLUX.1 [DEV] · NON-COMMERCIAL — CONCEPTING AND INTERNAL USE ONLY.<br />
        ENVIRONMENT · PRODUCT · TEXTURE · ATMOSPHERE. CLINICAL IMAGERY STAYS REAL PHOTOGRAPHY.
      </div>

      {!status && <div style={{ fontFamily: BRAND.mono, fontSize: 10, color: BRAND.ink300 }}>CHECKING BACKENDS…</div>}

      {status && !local && (
        <div style={{ fontFamily: BRAND.mono, fontSize: 10, color: BRAND.ink600, lineHeight: 1.6 }}>
          {status.comfyError || 'NO LOCAL COMFYUI.'}
          <div style={{ color: BRAND.ink300, marginTop: 6 }}>
            START COMFYUI (DEFAULT http://127.0.0.1:8188) — THIS PANEL WILL PICK IT UP AUTOMATICALLY.
          </div>
        </div>
      )}

      {local && (
        <>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Subject only — e.g. “instrument tray on a brushed-steel bench, morning light”. The house look, realism and negative are added for you."
            style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
          />

          {/* ── RENDER MODES ─────────────────────────────────────────
              Five best-practice bundles. Every mode is a KNOWN-GOOD recipe —
              engine, steps, draft, refine, negatives — so the fragile
              combinations (refine on a sketch, strict negatives on Turbo)
              simply never happen by accident. The raw controls below remain
              for anyone who wants to leave the path. */}
          {(() => {
            const engines = status?.engines || [];
            const zi = engines.includes('zimage');
            const MODES = [
              {
                key: 'instant', label: 'INSTANT', tag: '~5s',
                desc: 'Composition sketches while you think. Lowest fidelity, immediate — for finding the idea, not keeping it.',
                available: engines.includes('sdxl-turbo') || zi,
                apply: () => {
                  if (engines.includes('sdxl-turbo')) { setEngine('sdxl-turbo'); setSteps(null); }
                  else { setEngine('zimage'); setSteps(4); }
                  setDraftFirst(false); setRefine(false); setFast(false); setStrictNegative(false); setBatch(4);
                },
                match: () => (engine === 'sdxl-turbo' || (engine === 'zimage' && steps === 4)) && !refine && !draftFirst,
              },
              {
                key: 'daily', label: 'DAILY', tag: zi ? '~15s' : '~25s',
                desc: zi
                  ? 'The default: Z-Image at its 8-step sweet spot — photoreal, licensed to ship, draft in seconds, final anchored on it.'
                  : 'SDXL with the Lightning fast recipe — quick, shippable, draft-first. (Install Z-Image for the better default.)',
                available: zi || engines.includes('sdxl'),
                apply: () => {
                  if (zi) { setEngine('zimage'); setFast(false); } else { setEngine('sdxl'); setFast(true); }
                  setSteps(null); setDraftFirst(true); setRefine(false); setStrictNegative(false); setRealism(true); setBatch(1);
                },
                match: () => draftFirst && !refine && steps === null && ((zi && engine === 'zimage') || (!zi && engine === 'sdxl' && fast)),
              },
              {
                key: 'realism', label: 'REALISM+', tag: 'slowest',
                desc: 'Flux dev as designed (guidance 3.5, no CFG): the richest light and material a local model produces. Minutes on a Mac, non-commercial — for internal drafts when DAILY is not enough. Strict negatives stay OFF here: forcing real CFG onto a distilled model doubles the time and softens the image.',
                available: engines.includes('flux'),
                apply: () => { setEngine('flux'); setSteps(null); setDraftFirst(true); setRefine(false); setStrictNegative(false); setRealism(true); setFast(false); setBatch(1); },
                match: () => engine === 'flux' && !strictNegative && !refine,
              },
              {
                key: 'print', label: 'PRINT', tag: '~2min',
                desc: 'Maximal resolution: draft, anchored final, latent refine to ~2K (tiled decode on Macs), upscaler to 3K. For A-formats, posters, roll-ups.',
                available: zi || engines.includes('sdxl'),
                apply: () => { setEngine(zi ? 'zimage' : 'sdxl'); setSteps(null); setDraftFirst(true); setRefine(true); setRealism(true); setStrictNegative(false); setFast(false); setBatch(1); },
                match: () => refine && (engine === 'zimage' || engine === 'sdxl'),
              },
              {
                key: 'layout', label: 'LAYOUT-TRUE', tag: 'SDXL',
                desc: 'Your layout becomes a depth map: the scene keeps the space where your type sits. Pair with a photoreal checkpoint (★).',
                available: engines.includes('sdxl') && !!status?.conditioning?.control,
                apply: () => {
                  setEngine('sdxl'); setSteps(null); setDraftFirst(true); setRefine(false); setStrictNegative(false); setFast(false);
                  setCtrlSource('layout'); setCtrlType('depth');
                  const map = makeControlMap && makeControlMap();
                  if (map) setCtrlImage(map);
                },
                match: () => engine === 'sdxl' && ctrlSource === 'layout' && !!ctrlImage && !refine,
              },
            ].filter((m) => m.available);
            const active = MODES.find((m) => { try { return m.match(); } catch { return false; } });
            return (
              <>
                <div style={{ fontSize: 9.5, color: BRAND.ink600, marginBottom: 5, fontFamily: BRAND.mono, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Render mode <span style={{ color: BRAND.ink300, letterSpacing: 0, textTransform: 'none' }}> · {active ? active.desc : 'custom — your own combination of the controls below'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(MODES.length, 5)}, 1fr)`, gap: 3, marginBottom: 10 }}>
                  {MODES.map((m) => (
                    <button key={m.key} onClick={m.apply} title={`${m.desc}`} style={{ ...btn(active?.key === m.key), padding: '7px 2px' }}>
                      <span style={{ display: 'block' }}>{m.label}</span>
                      <span style={{ display: 'block', fontSize: 7.5, opacity: 0.7, marginTop: 1 }}>{m.tag}</span>
                    </button>
                  ))}
                </div>
              </>
            );
          })()}

          {/* Example prompts — the house look in practice. Click to load; the
              gate's own guidance applies: generate the place, not the person. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 10 }}>
            {[
              ['OR theatre', 'an empty, immaculate operating theatre, cool daylight, surgical instruments laid out on a tray'],
              ['Implant macro', 'titanium osteosynthesis plate on brushed steel, extreme macro, precision studio light, shallow depth of field'],
              ['Hands at work', 'close-up of gloved hands assembling a small titanium implant, cool neutral light, real skin texture'],
              ['Clinic dawn', 'modern hospital corridor at dawn, glass and pale stone, long shadows, nobody in sight'],
              ['Congress booth', 'empty trade-fair booth with clean architectural lines, warm spotlights, polished floor reflections'],
            ].map(([label, text]) => (
              <button key={label} onClick={() => setPrompt(text)} title={text}
                style={{
                  padding: '3px 8px', cursor: 'pointer', background: BRAND.paper,
                  border: `1px solid ${BRAND.ink100}`, color: BRAND.ink600,
                  fontFamily: BRAND.mono, fontSize: 8.5, letterSpacing: '0.06em',
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* Engine */}
          <div style={{ fontSize: 9.5, color: BRAND.ink600, marginBottom: 5, fontFamily: BRAND.mono, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Engine</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, marginBottom: 10 }}>
            {[
              ['zimage', '◆ Z-Image', 'Tongyi Z-Image Turbo · Flux-level photorealism in 8 steps · ~3× faster than Flux on Apple Silicon · Apache-2.0 (shippable) · CFG 1: the negative is not consumed'],
              ['flux', 'Flux', 'Best look · guidance-distilled: IGNORES the negative unless Strict is on · non-commercial'],
              ['sdxl', 'SDXL', 'Licensable output · always honours the negative'],
              ['sdxl-turbo', 'Turbo', '4 steps, seconds · always honours the negative · lower fidelity'],
            ].filter(([k]) => !status.engines || status.engines.includes(k) || k === 'flux')
              .map(([k, label, hint]) => (
                <button key={k} onClick={() => setEngine(k)} title={hint} style={btn(engine === k)}>{label}</button>
              ))}
          </div>

          {/* CHECKPOINT — the biggest lever on realism there is, bigger than any
              wording of the prompt. Stock SDXL base is a general-purpose model;
              a photoreal fine-tune (Juggernaut XL, RealVisXL) is the same
              architecture — same LoRA, same ControlNet, same IP-Adapter — trained
              specifically on photography. Hard-wiring 'sd_xl_base' and quietly
              ignoring a better checkpoint sitting in the same folder was a way of
              losing the single easiest win in the panel. */}
          {engine === 'sdxl' && (status.sdxlCkpts || []).length > 0 && (
            <>
              <div style={{ fontSize: 9.5, color: BRAND.ink600, marginBottom: 5, fontFamily: BRAND.mono, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Checkpoint
                <span style={{ color: BRAND.ink300, letterSpacing: 0, textTransform: 'none' }}> · the largest single lever on realism</span>
              </div>
              <select value={ckpt} onChange={(e) => setCkpt(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box', marginBottom: 4, padding: '8px 9px',
                  border: `1px solid ${BRAND.ink100}`, background: BRAND.paper, color: BRAND.ink,
                  fontFamily: BRAND.mono, fontSize: 10, borderRadius: 0,
                }}>
                <option value="">Auto · SDXL base 1.0</option>
                {(status.sdxlCkpts || []).map((f) => (
                  <option key={f} value={f}>
                    {(status.photorealCkpts || []).includes(f) ? '★ ' : ''}{f.replace(/\.safetensors$/i, '')}
                  </option>
                ))}
              </select>
              <div style={{ fontFamily: BRAND.mono, fontSize: 8.5, color: BRAND.ink300, lineHeight: 1.5, letterSpacing: '0.03em', marginBottom: 6 }}>
                {(status.photorealCkpts || []).includes(ckpt)
                  ? '★ PHOTOREAL FINE-TUNE. CHECK ITS LICENCE BEFORE COMMERCIAL USE — SDXL BASE IS OPENRAIL++, A CIVITAI FINE-TUNE CARRIES ITS OWN TERMS.'
                  : 'STOCK SDXL BASE IS A GENERAL-PURPOSE MODEL. A PHOTOREAL FINE-TUNE WILL BEAT ANY PROMPT WORDING YOU CAN WRITE.'}
              </div>
              {/* Say what was left out and WHY. A checkpoint that silently vanished
                  from the list is indistinguishable from a bug — and the reason is
                  the useful part: the architecture was read from the file, not
                  guessed from the name. */}
              {(status.excludedCkpts || []).length > 0 && (
                <details style={{ marginBottom: 10 }}>
                  <summary style={{ cursor: 'pointer', fontFamily: BRAND.mono, fontSize: 8.5, color: BRAND.ink300, letterSpacing: '0.06em' }}>
                    {status.excludedCkpts.length} CHECKPOINT{status.excludedCkpts.length === 1 ? '' : 'S'} NOT LISTED — WHY?
                  </summary>
                  <div style={{ marginTop: 5, padding: '7px 8px', background: BRAND.paper, border: `1px solid ${BRAND.ink100}` }}>
                    {status.excludedCkpts.map((x) => (
                      <div key={x.file} style={{ fontFamily: BRAND.mono, fontSize: 8.5, color: BRAND.ink600, lineHeight: 1.6 }}>
                        {String(x.file).replace(/\.safetensors$/i, '')}
                        <span style={{ color: BRAND.ink300 }}> — {x.why}</span>
                      </div>
                    ))}
                    <div style={{ fontFamily: BRAND.display, fontSize: 10, color: BRAND.ink300, marginTop: 6, lineHeight: 1.5 }}>
                      Architecture is read from each file’s safetensors header, not guessed from its
                      name. An SD 1.5 model in this SDXL pipeline does not error — it returns a
                      melted, rainbow-coloured image.
                    </div>
                  </div>
                </details>
              )}
            </>
          )}

          {/* FAST — Lightning/LCM as a LoRA on top of the checkpoint.
              NOT a "fewer steps" switch: these are distilled to run at CFG ~1, and
              4 steps at CFG 6 is the burnt, oversaturated mess people blame on the
              LoRA. The whole recipe (steps + cfg + sampler + scheduler) moves
              together on the server, or not at all. */}
          {engine === 'sdxl' && (status.fastLoras || []).length > 0 && (
            <button onClick={() => setFast((v) => !v)} style={{ ...btn(fast), width: '100%', marginBottom: 6 }}
              title={`Few-step generation via ${status.fastLoras[0]} — keeps the checkpoint (and its text encoder), just gets there faster`}>
              ⚡ Fast · {String(status.fastLoras[0]).replace(/\.safetensors$/i, '')}
            </button>
          )}

          {/* Speed & quality ladder: draft-first, print refine, seed lock, outputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 3, marginBottom: 6 }}>
            <button onClick={() => setDraftFirst((v) => !v)} style={btn(draftFirst)}
              title="Render a half-resolution draft with the same seed FIRST — it appears in seconds and stands in while the full-quality pass finishes. Same models, nothing reloads.">
              ▶ Draft first
            </button>
            <button onClick={() => setRefine((v) => !v)} style={btn(refine)}
              title="Latent hi-res second pass (~2x, low denoise): the model itself paints the extra resolution before the upscaler. Slower; meant for print. Z-Image and SDXL engines.">
              ▲ Refine · print
            </button>
            <button onClick={() => setLockSeed((v) => !v)} style={btn(lockSeed)}
              title={Number.isFinite(lastSeed) ? `Re-use seed ${lastSeed} — iterate on this exact image (change the prompt, keep the composition).` : 'After the first render, lock the seed to iterate on that exact image.'}>
              ⟳ Same seed{Number.isFinite(lastSeed) && lockSeed ? ` · ${String(lastSeed).slice(0, 6)}` : ''}
            </button>
            <button onClick={() => setBatch((n) => (n === 1 ? 2 : n === 2 ? 4 : n === 4 ? 6 : 1))} style={btn(batch > 1)}
              title="Variants per run — click to cycle 1 → 2 → 4 → 6. Time is linear. With more than one output, the draft stays a preview and each variant composes freely (anchoring one draft onto all of them would make near-copies).">
              ▤ Outputs ×{batch}
            </button>
          </div>

          {/* House look strength — the LoRA weight, for engines that carry one.
              (IBRA pattern; on engines without a house LoRA it has no effect and
              the run report already says NO HOUSE LORA.) */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9.5, color: BRAND.ink600, marginBottom: 3, fontFamily: BRAND.mono, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              House look · {strength.toFixed(2)}
              <span style={{ color: BRAND.ink300, letterSpacing: 0, textTransform: 'none' }}> · LoRA weight, double-click resets</span>
            </div>
            <input type="range" min="0.4" max="1.1" step="0.05" value={strength}
              onChange={(e) => setStrength(parseFloat(e.target.value))}
              onDoubleClick={() => setStrength(0.85)}
              style={{ width: '100%' }} />
          </div>

          {/* Realism + strict negatives */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginBottom: 6 }}>
            <button onClick={() => setRealism((v) => !v)} style={btn(realism)}
              title="Append the photoreal block: full-frame optics, physically accurate light, real skin texture, sensor grain. This is what actually drives realism on Flux.">
              ✦ Realism
            </button>
            <button onClick={() => setStrictNegative((v) => !v)} style={btn(strictNegative)}
              title="Give Flux a REAL negative branch (CFGGuider, cfg>1). Roughly 2× slower. SDXL/Turbo honour the negative regardless.">
              ⛔ Strict negatives
            </button>
          </div>

          {/* The safety gate is a brand-owner DECISION — so it lives here as a
              visible switch with its state named, not as a buried JSON flag.
              Flipping it moves the archived term list in or out of force. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <button
              onClick={async () => {
                await fetch('/api/gen/safety', {
                  method: 'POST', headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ enabled: !status?.safetyEnabled }),
                }).catch(() => {});
                probe();
              }}
              style={btn(!!status?.safetyEnabled)}
              title="When on, prompts naming people-as-clinicians (surgeon, patient, …) are refused with an explanation — people stay real photography. When off, no prompt is refused. Changing this is a brand-owner decision; the switch edits ai/prompt/house_style.json."
            >
              ▣ Safety gate · {status?.safetyEnabled ? 'ON' : 'OFF'}
            </button>
            <span style={{ fontSize: 9, fontFamily: BRAND.mono, color: status?.safetyEnabled ? '#0A7D3E' : BRAND.ink300, letterSpacing: '0.04em' }}>
              {status?.safetyEnabled ? 'PEOPLE-AS-CLINICIAN PROMPTS ARE REFUSED' : 'NO PROMPT IS REFUSED · PEOPLE STAY REAL PHOTOGRAPHY BY POLICY'}
            </span>
          </div>

          {/* The honesty line — never imply the negative did something it didn't. */}
          <div style={{
            fontSize: 9, fontFamily: BRAND.mono, lineHeight: 1.55, marginBottom: 8,
            letterSpacing: '0.04em',
            color: negWorks ? '#0A7D3E' : '#C8200A',
          }}>
            {negWorks
              ? '✓ THE NEGATIVE PROMPT REACHES THE SAMPLER WITH THESE SETTINGS.'
              : engine === 'zimage'
                ? '⚠ Z-IMAGE RUNS AT CFG 1 — THE NEGATIVE IS STRUCTURALLY ZEROED. REALISM AND EXCLUSIONS LIVE IN THE POSITIVE BLOCK (ALREADY HANDLED FOR YOU).'
                : '⚠ FLUX AT CFG 1 IGNORES THE NEGATIVE ENTIRELY. TURN ON STRICT NEGATIVES (SLOWER), OR SWITCH TO SDXL — OTHERWISE REALISM COMES ONLY FROM THE POSITIVE BLOCK.'}
          </div>

          <div style={{ fontSize: 9.5, color: BRAND.ink600, marginBottom: 5, fontFamily: BRAND.mono, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Extra negative <span style={{ color: BRAND.ink300, letterSpacing: 0, textTransform: 'none' }}>· appended to the house negative</span>
          </div>
          <input
            value={extraNegative}
            onChange={(e) => setExtraNegative(e.target.value)}
            placeholder="e.g. reflections, fingerprints, blue tint"
            style={{ width: '100%', boxSizing: 'border-box', marginBottom: 10 }}
          />

          {/* ── CONDITIONING ──────────────────────────────────────────
              Text can describe a look. It cannot hold one, and it certainly
              cannot hold a LAYOUT. These two do. */}
          <div style={{
            border: `1px solid ${BRAND.ink100}`, background: BRAND.bone,
            padding: '10px 10px 12px', marginBottom: 10,
          }}>
            <div style={{
              fontFamily: BRAND.mono, fontSize: 9.5, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: BRAND.ink, marginBottom: 8,
            }}>◈ Conditioning</div>

            {!isSdxl && (
              <>
                <div style={{ fontFamily: BRAND.mono, fontSize: 9, color: '#C8200A', lineHeight: 1.55, letterSpacing: '0.04em', marginBottom: 7 }}>
                  ⚠ CONDITIONING RUNS ON SDXL — CONTROLNET / IP-ADAPTER WEIGHTS ARE
                  ARCHITECTURE-SPECIFIC, SO OFFERING THEM ON {engine === 'zimage' ? 'Z-IMAGE' : 'FLUX'} WOULD ONLY FAIL INSIDE COMFYUI.
                </div>
                {/* A warning that tells you what to do but makes you do it elsewhere is
                    half a warning. Fix it from where it is raised. */}
                <button
                  style={{ ...btn(false), width: '100%', padding: '8px' }}
                  disabled={!status?.engines?.includes('sdxl')}
                  onClick={() => setEngine('sdxl')}>
                  {status?.engines?.includes('sdxl')
                    ? '→ Switch the engine to SDXL'
                    : 'SDXL base is not installed — npm run models'}
                </button>
              </>
            )}

            {isSdxl && (
              <>
                {/* 1 · REFERENCE LOOK — IP-Adapter */}
                <div style={{ fontSize: 9.5, color: BRAND.ink600, marginBottom: 5, fontFamily: BRAND.mono, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  1 · Reference look
                  <span style={{ color: BRAND.ink300, letterSpacing: 0, textTransform: 'none' }}> · IP-Adapter · steers colour, light, material</span>
                </div>
                {!canIp ? (
                  <div style={{
                    fontFamily: BRAND.mono, fontSize: 9, color: BRAND.ink600, lineHeight: 1.6,
                    marginBottom: 10, letterSpacing: '0.04em',
                    padding: '7px 8px', background: BRAND.paper, border: `1px solid ${BRAND.ink100}`,
                  }}>
                    UNAVAILABLE · MISSING {String(status?.conditioning?.ipMissing || 'IP-ADAPTER').toUpperCase()}
                    <div style={{ color: BRAND.ink300, marginTop: 4, textTransform: 'none', letterSpacing: 0, fontSize: 9 }}>
                      Install once: <code>bash ai/tools/setup_conditioning.sh /path/to/ComfyUI</code> — then restart
                      ComfyUI. It clones ComfyUI_IPAdapter_plus and fetches the SDXL IP-Adapter + CLIP-Vision weights.
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{
                        width: 56, height: 56, flexShrink: 0, border: `1px solid ${BRAND.ink100}`,
                        background: BRAND.paper, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: BRAND.mono, fontSize: 8, color: BRAND.ink300,
                      }}>
                        {refImage
                          ? <img src={refImage} alt="reference" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : 'NONE'}
                      </div>
                      <div style={{ display: 'grid', gap: 4, flex: 1 }}>
                        <button style={btn(false)} disabled={!currentImage}
                          onClick={() => { const d = imgToDataUrl(currentImage); d ? setRefImage(d) : setError('That image is cross-origin and cannot be read back — upload it instead.'); }}>
                          Use the image on the canvas
                        </button>
                        <label style={{ ...btn(false), textAlign: 'center' }}>
                          Upload / pick from the library
                          <input type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) readFileAsDataUrl(f, setRefImage); e.target.value = ''; }} />
                        </label>
                        {refImage && <button style={btn(false)} onClick={() => setRefImage(null)}>Clear reference</button>}
                      </div>
                    </div>
                    {library.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 6, paddingBottom: 2 }}>
                        {library.slice(0, 12).map((it, i) => (
                          <img key={i} src={it.src || it} alt="" onClick={() => setRefImage(it.src || it)}
                            title="Condition on this library image"
                            style={{
                              width: 40, height: 40, objectFit: 'cover', cursor: 'pointer', flexShrink: 0,
                              border: `1px solid ${refImage === (it.src || it) ? BRAND.goldDeep : BRAND.ink100}`,
                            }} />
                        ))}
                      </div>
                    )}
                    {refImage && (
                      <label style={{ display: 'block', fontFamily: BRAND.mono, fontSize: 9, color: BRAND.ink600, marginBottom: 10, letterSpacing: '0.04em' }}>
                        STRENGTH {refStrength.toFixed(2)}
                        <input type="range" min="0" max="1.2" step="0.05" value={refStrength}
                          onChange={(e) => setRefStrength(Number(e.target.value))}
                          style={{ width: '100%' }} />
                      </label>
                    )}
                  </>
                )}

                {/* 2 · COMPOSITION — ControlNet, fed by the layout itself */}
                <div style={{ fontSize: 9.5, color: BRAND.ink600, marginBottom: 5, fontFamily: BRAND.mono, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  2 · Composition
                  <span style={{ color: BRAND.ink300, letterSpacing: 0, textTransform: 'none' }}> · ControlNet · the layout becomes the input</span>
                </div>
                {!canControl ? (
                  <div style={{
                    fontFamily: BRAND.mono, fontSize: 9, color: BRAND.ink600, lineHeight: 1.6,
                    letterSpacing: '0.04em',
                    padding: '7px 8px', background: BRAND.paper, border: `1px solid ${BRAND.ink100}`,
                  }}>
                    UNAVAILABLE · MISSING {String(status?.conditioning?.controlMissing || 'CONTROLNET MODELS').toUpperCase()}
                    <div style={{ color: BRAND.ink300, marginTop: 4, textTransform: 'none', letterSpacing: 0, fontSize: 9 }}>
                      Install once: <code>bash ai/tools/setup_conditioning.sh /path/to/ComfyUI</code> — then restart
                      ComfyUI. It fetches the SDXL depth / canny ControlNets into models/controlnet.
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 6 }}>
                      <button style={btn(ctrlSource === 'layout')} onClick={() => { setCtrlSource('layout'); setCtrlImage(null); }}>
                        From the layout
                      </button>
                      <button style={btn(ctrlSource === 'photo')} onClick={() => { setCtrlSource('photo'); setCtrlImage(null); }}>
                        From a photo
                      </button>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${Math.max(1, (ctrlSource === 'layout' ? layoutKinds : controlTypes).length)}, 1fr)`,
                      gap: 4, marginBottom: 6,
                    }}>
                      {(ctrlSource === 'layout' ? layoutKinds : controlTypes).map((k) => (
                        <button key={k} style={btn(ctrlType === k)} onClick={() => setCtrlType(k)}>{k}</button>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gap: 4, marginBottom: 6 }}>
                      {ctrlSource === 'layout' ? (
                        <button style={btn(false)} onClick={refreshLayoutMap}>
                          {ctrlImage ? '↻ Rebuild from the current layout' : '⌗ Build a map from the current layout'}
                        </button>
                      ) : (
                        <label style={{ ...btn(false), textAlign: 'center' }}>
                          Upload a reference photo
                          <input type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) readFileAsDataUrl(f, setCtrlImage); e.target.value = ''; }} />
                        </label>
                      )}
                    </div>
                    {/* Full width, at the canvas's aspect. A 56px chip of a mostly-dark
                        depth map is indistinguishable from a bug — you have to be able
                        to SEE what you are sending the model. */}
                    {ctrlImage && (
                      <>
                        <img src={ctrlImage} alt="control map"
                          title="This is what the model is given. Click to open it full size."
                          onClick={() => { const w = window.open(); if (w) w.document.write(`<img src="${ctrlImage}" style="width:100%">`); }}
                          style={{
                            width: '100%', display: 'block', cursor: 'zoom-in',
                            border: `1px solid ${BRAND.ink100}`, background: '#000', marginBottom: 4,
                            aspectRatio: `${format.w} / ${format.h}`, objectFit: 'contain',
                          }} />
                        <button style={{ ...btn(false), width: '100%', marginBottom: 6 }}
                          onClick={() => setCtrlImage(null)}>Clear map</button>
                      </>
                    )}

                    {ctrlImage && (
                      <label style={{ display: 'block', fontFamily: BRAND.mono, fontSize: 9, color: BRAND.ink600, marginBottom: 6, letterSpacing: '0.04em' }}>
                        STRENGTH {ctrlStrength.toFixed(2)}
                        <input type="range" min="0" max="1.5" step="0.05" value={ctrlStrength}
                          onChange={(e) => setCtrlStrength(Number(e.target.value))}
                          style={{ width: '100%' }} />
                      </label>
                    )}

                    <div style={{ fontFamily: BRAND.mono, fontSize: 8.5, color: BRAND.ink300, lineHeight: 1.55, letterSpacing: '0.03em' }}>
                      {ctrlSource === 'layout'
                        ? 'DEPTH ONLY — WHITE IS NEAR, DARK IS FAR. THE MAP IS DERIVED FROM WHERE THE TYPE AND THE MARK ACTUALLY SIT: THE PICTURE GOES IN THE LIGHT AREA, THE HEADLINE GETS RECESSIVE BACKGROUND. IT NEVER SEES A LETTERFORM. AN EDGE MAP (CANNY/SCRIBBLE) NEEDS SOMETHING WITH REAL EDGES — USE “FROM A PHOTO”.'
                        : 'THE PHOTO IS RUN THROUGH A PREPROCESSOR ON THE SERVER, THEN USED AS THE CONTROL MAP.'}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <button onClick={busy ? cancel : generate} disabled={!busy && !prompt.trim()}
            style={{
              width: '100%', padding: '12px', cursor: (busy || prompt.trim()) ? 'pointer' : 'not-allowed',
              background: busy ? BRAND.paper : BRAND.ink, color: busy ? BRAND.ink : BRAND.bone00,
              border: `1px solid ${BRAND.ink}`, borderRadius: 0,
              fontFamily: BRAND.mono, fontSize: 11, fontWeight: 500,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              opacity: (!busy && !prompt.trim()) ? 0.4 : 1,
            }}>
            {busy ? `✕ Cancel · ${elapsed}s` : '✦ Generate'}
          </button>

          {/* Real steps from ComfyUI's socket — not a fake bar. And, when the
              backend streams preview frames (--preview-method, set by npm
              start), the actual image FORMS in front of you: latent previews
              per step, then the finished half-res draft, then the final. */}
          {busy && job && (
            <div style={{ marginTop: 8 }}>
              {job.preview && (
                <div style={{ position: 'relative', marginBottom: 6 }}>
                  <img src={job.preview} alt="live preview" style={{ width: '100%', display: 'block', filter: job.phase === 'draft' ? 'none' : undefined }} />
                  <span style={{
                    position: 'absolute', top: 6, left: 6, padding: '2px 6px',
                    background: 'rgba(19,19,16,0.82)', color: BRAND.gold,
                    fontFamily: BRAND.mono, fontSize: 8.5, letterSpacing: '0.12em',
                  }}>
                    {job.draftImages
                      ? 'DRAFT · FINAL RENDERING'
                      : job.steps
                        ? `DENOISING · ${Math.round(((job.step ?? 0) / job.steps) * 100)}%`
                        : 'LIVE PREVIEW'}
                  </span>
                </div>
              )}
              {/* The one silent failure mode: an ALREADY-RUNNING ComfyUI that was
                  started without --preview-method streams no frames — steps tick,
                  nothing shows. Name it and name the fix, right here. */}
              {!job.preview && (job.step ?? 0) >= 2 && (
                <div style={{
                  fontFamily: BRAND.mono, fontSize: 8.5, color: BRAND.ink300,
                  lineHeight: 1.5, letterSpacing: '0.04em', marginBottom: 5,
                }}>
                  NO LIVE PREVIEW FROM THIS COMFYUI — IT WAS STARTED WITHOUT A PREVIEW METHOD.
                  QUIT IT AND RELAUNCH VIA npm start TO WATCH THE DENOISING LIVE.
                </div>
              )}
              <div style={{ height: 4, background: BRAND.ink100, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${Math.round((job.progress || 0) * 100)}%`,
                  background: BRAND.gold, transition: 'width 0.2s',
                }} />
              </div>
              <div style={{ fontSize: 9, fontFamily: BRAND.mono, color: BRAND.ink600, marginTop: 4, letterSpacing: '0.06em' }}>
                {job.phase === 'draft' ? 'DRAFT · ' : ''}
                {job.steps ? `STEP ${job.step ?? 0} / ${job.steps}` : (job.status || 'QUEUED').toUpperCase()}
                {job.node ? ` · ${String(job.node).toUpperCase()}` : ''}
                {job.draftMs ? ` · DRAFT IN ${(job.draftMs / 1000).toFixed(1)}S` : ''}
              </div>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 8, fontSize: 10.5, color: '#C8200A', fontFamily: BRAND.mono, lineHeight: 1.5 }}>
              ERROR · {error}
              {/* A refusal that won't say WHICH word it objected to is a riddle.
                  The server knows; show it, and say what to write instead. */}
              {blockedTerm && (
                <div style={{
                  marginTop: 7, padding: '8px 9px', background: BRAND.paper,
                  border: `1px solid ${BRAND.ink100}`, color: BRAND.ink600, fontSize: 9.5, lineHeight: 1.6,
                }}>
                  <div style={{ color: BRAND.ink, letterSpacing: '0.06em' }}>
                    TRIGGERED BY: “{String(blockedTerm).toUpperCase()}”
                  </div>
                  <div style={{ marginTop: 5, fontFamily: BRAND.display, fontSize: 11, color: BRAND.ink600, letterSpacing: 0 }}>
                    This is the Medartis safety gate, not the model. A generated human
                    presented as a surgeon is a regulatory and credibility problem for a
                    medical-device manufacturer — so people-as-clinicians stay real
                    photography (Canto, § {secNo.CANTO}).
                    <div style={{ marginTop: 6 }}>
                      Generate the <b>place</b>, not the person: “an empty, immaculate
                      operating theatre, cool daylight, instruments laid out on a tray”.
                    </div>
                    <div style={{ marginTop: 6, color: BRAND.ink300, fontSize: 10 }}>
                      The rule lives in <code>ai/prompt/house_style.json</code> → <code>blocklist</code>.
                      Changing it is a brand-owner decision, not a prompt-engineering one.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* What the run ACTUALLY did */}
          {lastMeta && !busy && (
            <div style={{ marginTop: 8, fontSize: 9, fontFamily: BRAND.mono, color: BRAND.ink600, letterSpacing: '0.04em', lineHeight: 1.55 }}>
              {String(lastMeta.engine || '').toUpperCase()}
              {lastMeta.ckpt ? ` · ${String(lastMeta.ckpt).replace(/\.safetensors$/i, '')}` : ''}
              {lastMeta.fast ? ` · ⚡ ${String(lastMeta.fast).replace(/\.safetensors$/i, '')}` : ''}
              {lastMeta.lora ? ` · LORA ${lastMeta.lora}` : ' · NO HOUSE LORA'}
              {' · NEGATIVE '}
              <span style={{ color: lastMeta.negativeHonoured ? '#0A7D3E' : '#C8200A' }}>
                {lastMeta.negativeHonoured ? 'APPLIED' : 'IGNORED BY THIS ENGINE'}
              </span>
              {lastMeta.realism ? ' · REALISM ON' : ''}
              {Number.isFinite(lastMeta.seed) ? ` · SEED ${lastMeta.seed}` : ''}
              {lastMeta.batch > 1 ? ` · ${lastMeta.batch} OUTPUTS` : ''}
              {lastMeta.anchored ? ' · FINAL ANCHORED ON DRAFT (SAME COMPOSITION, DENOISE 0.58)' : lastMeta.draft ? ' · DRAFT-FIRST (INDEPENDENT)' : ''}
              {lastMeta.refine ? ` · REFINED ${lastMeta.refine.width}×${lastMeta.refine.height} @ ${lastMeta.refine.denoise}` : ''}
              {lastMeta.tookMs ? ` · ${(lastMeta.tookMs / 1000).toFixed(1)}S` : ''}
              {/* Conditioning, reported by the SERVER — never by the checkbox. One
                  line per input, present or absent. Buried in a wrapping sentence
                  you cannot tell "the reference was ignored" from "the text ran off
                  the edge", and those are very different facts. */}
              {lastMeta.conditioning && (
                <div style={{ marginTop: 5, borderTop: `1px solid ${BRAND.ink100}`, paddingTop: 5 }}>
                  <div style={{ color: lastMeta.conditioning.ip ? '#0A7D3E' : BRAND.ink300 }}>
                    {lastMeta.conditioning.ip ? '✓' : '·'} REFERENCE (IP-ADAPTER) {lastMeta.conditioning.ip ? 'APPLIED' : 'NOT USED'}
                  </div>
                  <div style={{ color: lastMeta.conditioning.control ? '#0A7D3E' : BRAND.ink300 }}>
                    {lastMeta.conditioning.control ? '✓' : '·'} COMPOSITION (CONTROLNET){' '}
                    {lastMeta.conditioning.control
                      ? `${String(lastMeta.conditioning.controlType || '').toUpperCase()} · ${lastMeta.conditioning.controlModel || ''}`
                      : 'NOT USED'}
                  </div>
                  {(lastMeta.conditioning.notes || []).map((n, i) => (
                    <div key={i} style={{ color: '#C8200A' }}>⚠ {n.toUpperCase()}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {results.length > 0 && (
            <>
              <div style={{ fontSize: 9, color: BRAND.ink300, margin: '10px 0 6px', fontFamily: BRAND.mono, letterSpacing: '0.06em' }}>
                CLICK TO USE · <span style={{ color: BRAND.gold }}>+LIB</span> SAVES IT
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {results.map((r0, i) => {
                  const entry = typeof r0 === 'string' ? { src: r0 } : r0; // legacy entries survive
                  const src = entry.src;
                  const info = [
                    entry.engine ? String(entry.engine).toUpperCase() : null,
                    Number.isFinite(entry.seed) ? `SEED ${entry.seed}` : null,
                    entry.draft ? 'DRAFT (half-res)' : null,
                    entry.upscaled ? 'UPSCALED' : null,
                    entry.prompt || null,
                  ].filter(Boolean).join('\n');
                  return (
                  <div key={i} title={info} style={{
                    position: 'relative', aspectRatio: '1', overflow: 'hidden',
                    border: `1px solid ${entry.draft ? BRAND.gold : BRAND.ink100}`, cursor: 'pointer', background: BRAND.bone,
                  }}
                    onClick={() => { const im = new Image(); im.onload = () => onPickImage(im); im.src = src; }}>
                    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <span style={{
                      position: 'absolute', top: 3, left: 3, padding: '1px 4px',
                      background: 'rgba(19,19,16,0.72)', color: entry.draft ? BRAND.gold : BRAND.bone00,
                      fontSize: 8, fontFamily: BRAND.mono, letterSpacing: '0.06em',
                    }}>{entry.draft ? 'DRAFT' : entry.upscaled ? 'AI · 2X' : entry.refined ? 'AI · ✦' : 'AI'}</span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        const im = new Image();
                        im.onload = () => onSaveToLibrary(im, `AI · ${(entry.prompt || prompt).slice(0, 28)}`, 'ai');
                        im.src = src;
                      }}
                      title="Save to the standard library"
                      style={{
                        position: 'absolute', top: 3, right: 3, padding: '1px 5px',
                        background: 'rgba(19,19,16,0.72)', color: BRAND.bone00,
                        fontSize: 8.5, fontFamily: BRAND.mono, cursor: 'pointer', borderRadius: 2,
                      }}>+LIB</span>
                    {/* Bottom action row: reuse the recipe, or upscale THIS image. */}
                    <div style={{ position: 'absolute', bottom: 3, left: 3, right: 3, display: 'flex', gap: 3 }}
                         onClick={(e) => e.stopPropagation()}>
                      {entry.prompt && (
                        <span
                          onClick={() => {
                            setPrompt(entry.prompt);
                            if (Number.isFinite(entry.seed)) { setLastSeed(entry.seed); setLockSeed(true); }
                          }}
                          title={`Reuse this image's recipe: puts the prompt back in the box and locks its seed.\n${entry.prompt}`}
                          style={{
                            padding: '1px 5px', background: 'rgba(19,19,16,0.72)', color: BRAND.bone00,
                            fontSize: 8.5, fontFamily: BRAND.mono, cursor: 'pointer', borderRadius: 2,
                          }}>⟳ RECIPE</span>
                      )}
                      {status?.zimage && !entry.upscaled && (
                        <span
                          onClick={() => refineResult(entry, i)}
                          title="Refine this exact image: img2img on Z-Image at partial denoise — same composition, better detail. (IBRA's middle stage.)"
                          style={{
                            padding: '1px 5px', background: 'rgba(19,19,16,0.72)',
                            color: refining === i ? BRAND.gold : BRAND.bone00,
                            fontSize: 8.5, fontFamily: BRAND.mono, cursor: 'pointer', borderRadius: 2,
                          }}>{refining === i ? '…' : '✦'}</span>
                      )}
                      <span
                        onClick={() => setDetail(detail?.src === entry.src ? null : entry)}
                        title="Provenance: what made this image — copy the prompt, download this exact file."
                        style={{
                          padding: '1px 5px', background: 'rgba(19,19,16,0.72)',
                          color: detail?.src === entry.src ? BRAND.gold : BRAND.bone00,
                          fontSize: 8.5, fontFamily: BRAND.mono, cursor: 'pointer', borderRadius: 2,
                        }}>ⓘ</span>
                      {!entry.upscaled && (
                        <span
                          onClick={() => upscaleResult(entry, i)}
                          title="Upscale this image with the installed ESRGAN model (server-side), full print target."
                          style={{
                            padding: '1px 5px', background: 'rgba(19,19,16,0.72)',
                            color: upscaling === i ? BRAND.gold : BRAND.bone00,
                            fontSize: 8.5, fontFamily: BRAND.mono, cursor: 'pointer', borderRadius: 2, marginLeft: 'auto',
                          }}>{upscaling === i ? '…' : '⤢ 2X'}</span>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
              {detail && (
                <div style={{ marginTop: 6, padding: '9px 10px', background: BRAND.bone, border: `1px solid ${BRAND.ink100}` }}>
                  <div style={{ fontFamily: BRAND.mono, fontSize: 8.5, color: BRAND.ink600, lineHeight: 1.6, letterSpacing: '0.03em', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {[
                      detail.engine ? `ENGINE ${String(detail.engine).toUpperCase()}` : null,
                      Number.isFinite(detail.seed) ? `SEED ${detail.seed}` : null,
                      detail.draft ? 'DRAFT (half-res)' : null,
                      detail.refined ? 'REFINED' : null,
                      detail.upscaled ? 'UPSCALED' : null,
                    ].filter(Boolean).join(' · ')}
                    {detail.prompt ? `\n${detail.prompt}` : ''}
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 7 }}>
                    {detail.prompt && (
                      <button onClick={() => navigator.clipboard?.writeText(detail.prompt)}
                        style={{ ...btn(false), flex: 1, padding: '5px 0', fontSize: 8.5 }}>COPY PROMPT</button>
                    )}
                    <button
                      onClick={() => {
                        const a = document.createElement('a');
                        a.href = detail.src;
                        a.download = `medartis-ai-${Number.isFinite(detail.seed) ? detail.seed : Date.now().toString(36)}.png`;
                        a.click();
                      }}
                      style={{ ...btn(false), flex: 1, padding: '5px 0', fontSize: 8.5 }}>DOWNLOAD PNG</button>
                    <button
                      onClick={() => {
                        const im = new Image();
                        im.onload = () => onSaveToLibrary(im, `AI · ${(detail.prompt || prompt).slice(0, 28)}`, 'ai');
                        im.src = detail.src;
                      }}
                      style={{ ...btn(false), flex: 1, padding: '5px 0', fontSize: 8.5 }}>SAVE TO LIBRARY</button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </Section>
  );
};

export default GenerateSection;
