import { useState, useEffect, Component, type ReactNode } from 'react'
import {
  type Request, type RequestSummary, type ErrorGroup, type ReplayOverride,
  fetchRequests, fetchRequest, fetchErrors, fetchCurl, replayRequest, resolveError,
  onNewRequest, onNewError, onConnectionChange, timeAgo,
} from './api'

// ─── Types ────────────────────────────────────────────────────────────────────

type View = 'marketing' | 'login' | 'signup' | 'dashboard'
type DashView = 'requests' | 'errors' | 'empty'
type AppError = ErrorGroup & { expanded: boolean }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: number): { bg: string; text: string; dot: string } {
  if (status >= 200 && status < 300) return { bg: 'var(--green-dim)', text: 'var(--green)', dot: 'var(--green)' }
  if (status >= 400 && status < 500) return { bg: 'var(--amber-dim)', text: 'var(--amber)', dot: 'var(--amber)' }
  return { bg: 'var(--red-dim)', text: 'var(--red)', dot: 'var(--red)' }
}

function methodColor(method: string): string {
  switch (method) {
    case 'GET': return 'var(--blue)'
    case 'POST': return 'var(--green)'
    case 'PUT': return 'var(--amber)'
    case 'DELETE': return 'var(--red)'
    case 'PATCH': return '#A78BFA'
    default: return 'var(--text-muted)'
  }
}

function durationColor(ms: number): string {
  if (ms < 200) return 'var(--text)'
  if (ms < 800) return 'var(--amber)'
  return 'var(--red)'
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconGrid() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="5" height="5" rx="1" fill="currentColor" opacity=".7"/>
      <rect x="9" y="2" width="5" height="5" rx="1" fill="currentColor" opacity=".7"/>
      <rect x="2" y="9" width="5" height="5" rx="1" fill="currentColor" opacity=".7"/>
      <rect x="9" y="9" width="5" height="5" rx="1" fill="currentColor" opacity=".7"/>
    </svg>
  )
}

function IconActivity() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1 8h2l2-5 3 10 2-7 1 2h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconAlertTriangle() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2.5L14 13H2L8 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M8 6.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="8" cy="11" r="0.75" fill="currentColor"/>
    </svg>
  )
}

function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function IconChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M4.5 2.5L7.5 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 4.5L6 7.5L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconCopy() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="5" y="5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M4 9H3C2.45 9 2 8.55 2 8V3C2 2.45 2.45 2 3 2H8C8.55 2 9 2.45 9 3V4" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
}

function IconPlay() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M3 2L10 6L3 10V2Z" fill="currentColor"/>
    </svg>
  )
}

function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function IconGithub() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
    </svg>
  )
}

function IconTerminal() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 6.5L7.5 8.5L5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 10.5h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function IconZap() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M9.5 2L3 9h5l-1.5 5L14 7H9L9.5 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  )
}

function IconEye() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1 8C1 8 3.5 3 8 3S15 8 15 8 12.5 13 8 13 1 8 1 8Z" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
}

function IconShield() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2L13 4.5V8C13 10.76 10.76 13.27 8 14C5.24 13.27 3 10.76 3 8V4.5L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M6 8L7.5 9.5L10.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Shared components ────────────────────────────────────────────────────────

function Badge({ status }: { status: number }) {
  const c = statusColor(status)
  return (
    <span className="mono" style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500,
      background: c.bg, color: c.text,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot, flexShrink: 0 }}/>
      {status}
    </span>
  )
}

function MethodTag({ method }: { method: string }) {
  return (
    <span className="mono" style={{
      display: 'inline-block', padding: '1px 6px',
      borderRadius: 4, fontSize: 11, fontWeight: 500,
      color: methodColor(method),
      background: `${methodColor(method)}18`,
      minWidth: 44, textAlign: 'center',
    }}>
      {method}
    </span>
  )
}

// ─── Marketing Page ───────────────────────────────────────────────────────────

function MarketingPage({ onNav }: { onNav: (v: View) => void }) {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Nav */}
      <nav style={{
        borderBottom: '1px solid var(--border)',
        padding: '0 40px',
        height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(11,11,12,0.92)', backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6,
              background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>N</span>
            </div>
            <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-0.3px' }}>NUMBAT</span>
          </div>
          <div style={{ display: 'flex', gap: 32 }}>
            {['Docs', 'Changelog', 'GitHub'].map(l => (
              <a key={l} href={l === 'GitHub' ? 'https://github.com' : '#'} style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 14, transition: 'color .15s' }}
                onClick={e => { if (l !== 'GitHub') e.preventDefault() }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                {l}
              </a>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onNav('login')} style={{
            background: 'transparent', border: '1px solid var(--border2)',
            color: 'var(--text-muted)', padding: '6px 16px', borderRadius: 'var(--radius)',
            cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all .15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--text-subtle)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border2)' }}>
            Sign in
          </button>
          <button onClick={() => onNav('dashboard')} style={{
            background: 'var(--blue)', border: 'none',
            color: '#fff', padding: '6px 16px', borderRadius: 'var(--radius)',
            cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'background .15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--blue-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--blue)')}>
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 860, margin: '0 auto', padding: '96px 40px 80px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '4px 12px', borderRadius: 24, fontSize: 12, fontWeight: 500,
          border: '1px solid var(--border2)', color: 'var(--text-muted)',
          marginBottom: 32,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }}/>
          v1.0 — Now in public beta
        </div>

        <h1 style={{
          fontSize: 56, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-1.5px',
          margin: '0 0 24px',
          color: 'var(--text)',
        }}>
          See everything your app<br />is doing — in real time.
        </h1>

        <p style={{
          fontSize: 18, lineHeight: 1.65, color: 'var(--text-muted)',
          maxWidth: 560, margin: '0 0 40px',
        }}>
          NUMBAT captures every API request, runtime error, and performance event from your localhost. No cloud setup. No config files. No agent required.
        </p>

        <div style={{ display: 'flex', gap: 12, marginBottom: 64 }}>
          <button onClick={() => onNav('dashboard')} style={{
            background: 'var(--blue)', border: 'none',
            color: '#fff', padding: '10px 24px', borderRadius: 'var(--radius)',
            cursor: 'pointer', fontSize: 14, fontWeight: 600, transition: 'background .15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--blue-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--blue)')}>
            Get Started — it's free
          </button>
          <button onClick={() => onNav('dashboard')} style={{
            background: 'transparent', border: '1px solid var(--border2)',
            color: 'var(--text-muted)', padding: '10px 24px', borderRadius: 'var(--radius)',
            cursor: 'pointer', fontSize: 14, fontWeight: 500, transition: 'all .15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--text-subtle)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border2)' }}>
            View Demo →
          </button>
        </div>

        {/* Terminal block */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        }}>
          <div style={{
            padding: '10px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5F57' }}/>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FFBD2E' }}/>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28CA41' }}/>
            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-subtle)' }}>Terminal</span>
          </div>
          <div className="mono" style={{ padding: '20px 24px', fontSize: 13, lineHeight: 1.8 }}>
            <div><span style={{ color: 'var(--text-subtle)' }}>$</span> <span style={{ color: 'var(--text)' }}>npm install -g numbat</span></div>
            <div style={{ color: 'var(--text-subtle)', marginTop: 4 }}>+ numbat@1.0.3 installed globally</div>
            <div style={{ marginTop: 8 }}><span style={{ color: 'var(--text-subtle)' }}>$</span> <span style={{ color: 'var(--text)' }}>numbat start</span></div>
            <div style={{ color: 'var(--green)', marginTop: 4 }}>✓ Listening on localhost:9000</div>
            <div style={{ color: 'var(--green)' }}>✓ Dashboard at <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>http://localhost:3000</span></div>
            <div style={{ color: 'var(--text-subtle)', marginTop: 8 }}>Watching for requests...</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ color: 'var(--blue)' }}>GET</span>
              <span style={{ color: 'var(--text)' }}>/api/users/me</span>
              <span style={{ color: 'var(--green)' }}>200</span>
              <span style={{ color: 'var(--text-subtle)' }}>42ms</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {[
              { label: 'p95 capture latency', value: '<50ms' },
              { label: 'Requests per second', value: '10,000+' },
              { label: 'Supported runtimes', value: 'Node, Deno, Bun' },
              { label: 'Setup time', value: '< 30 seconds' },
            ].map((s, i) => (
              <div key={i} style={{
                padding: '32px 0',
                borderRight: i < 3 ? '1px solid var(--border)' : 'none',
                paddingRight: i < 3 ? 40 : 0,
                paddingLeft: i > 0 ? 40 : 0,
              }}>
                <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text)' }}>{s.value}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <section style={{ maxWidth: 860, margin: '0 auto', padding: '80px 40px' }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--blue)', textTransform: 'uppercase', marginBottom: 12 }}>Features</div>
          <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.5px', margin: 0, color: 'var(--text)' }}>
            Built for the debug loop,<br />not the boardroom.
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          {[
            {
              icon: <IconActivity />,
              title: 'Request Inspector',
              desc: 'Capture every HTTP request with full headers, body, and timing. Click any row to replay it against your live server.',
            },
            {
              icon: <IconAlertTriangle />,
              title: 'Error Tracking',
              desc: 'Stack traces, error chains, and affected endpoints — grouped automatically. No Sentry account required.',
            },
            {
              icon: <IconZap />,
              title: 'Real-time Stream',
              desc: 'Events appear in under 50ms. No polling, no page refresh, no batching delay.',
            },
            {
              icon: <IconShield />,
              title: 'Stays on Localhost',
              desc: 'Nothing leaves your machine. No telemetry, no cloud sync, no vendor lock-in. Your traffic is yours.',
            },
          ].map((f, i) => (
            <div key={i} style={{
              padding: '32px', background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: i === 0 ? '8px 0 0 0' : i === 1 ? '0 8px 0 0' : i === 2 ? '0 0 0 8px' : '0 0 8px 0',
              transition: 'background .15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}>
              <div style={{ color: 'var(--blue)', marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px', color: 'var(--text)' }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '80px 40px' }}>
          <div style={{ marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--blue)', textTransform: 'uppercase', marginBottom: 12 }}>How it works</div>
            <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.5px', margin: 0 }}>Three commands to full visibility.</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 40 }}>
            {[
              { step: '01', title: 'Install the CLI', body: 'Run', code: 'npm install -g numbat', post: 'in any shell. Node 18+ required.' },
              { step: '02', title: 'Start the agent', body: 'Run', code: 'numbat start', post: 'from your project root. NUMBAT binds to localhost:9000 automatically.' },
              { step: '03', title: 'Open the dashboard', body: 'Navigate to', code: 'localhost:3000', post: 'and watch requests arrive as they happen.' },
            ].map((s, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-subtle)', marginBottom: 16, letterSpacing: '0.05em' }}>{s.step}</div>
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.65 }}>
                  {s.body} <code className="mono" style={{
                    background: 'var(--surface3)', color: 'var(--blue)',
                    padding: '1px 6px', borderRadius: 4, fontSize: 12,
                  }}>{s.code}</code> {s.post}
                </p>
                {i < 2 && (
                  <div style={{
                    position: 'absolute', right: -24, top: 48,
                    color: 'var(--border2)',
                  }}>
                    <IconChevronRight />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product preview */}
      <section style={{ maxWidth: 860, margin: '0 auto', padding: '80px 40px' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--blue)', textTransform: 'uppercase', marginBottom: 12 }}>Product</div>
          <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.5px', margin: 0 }}>The dashboard, without the noise.</h2>
        </div>
        <div style={{
          border: '1px solid var(--border)', borderRadius: 'var(--radius)',
          overflow: 'hidden', background: 'var(--surface)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        }}>
          {/* Fake topbar */}
          <div style={{
            padding: '0 16px', height: 48, borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>N</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>NUMBAT</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--surface2)', borderRadius: 6, border: '1px solid var(--border)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }}/>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>localhost:3000</span>
            </div>
          </div>
          {/* Fake table */}
          <div>
            <div style={{
              display: 'grid', gridTemplateColumns: '72px 1fr 64px 72px 100px',
              padding: '8px 16px', borderBottom: '1px solid var(--border)',
            }}>
              {['Method', 'Endpoint', 'Status', 'Duration', 'Timestamp'].map(h => (
                <span key={h} style={{ fontSize: 11, color: 'var(--text-subtle)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
              ))}
            </div>
            {[
              { id: '1', method: 'GET' as const, endpoint: '/api/users/me', status: 200, duration: 42, timestamp: '2s ago' },
              { id: '2', method: 'POST' as const, endpoint: '/api/auth/refresh', status: 200, duration: 89, timestamp: '8s ago' },
              { id: '3', method: 'GET' as const, endpoint: '/api/projects?page=1…', status: 200, duration: 156, timestamp: '15s ago' },
              { id: '4', method: 'DELETE' as const, endpoint: '/api/projects/proj_x8k2m', status: 403, duration: 12, timestamp: '34s ago' },
              { id: '5', method: 'GET' as const, endpoint: '/api/billing/subscription', status: 500, duration: 891, timestamp: '1m ago' },
            ].map((r, i) => (
              <div key={r.id} style={{
                display: 'grid', gridTemplateColumns: '72px 1fr 64px 72px 100px',
                padding: '10px 16px', borderBottom: '1px solid var(--border)',
                alignItems: 'center',
                background: i === 2 ? 'var(--surface2)' : 'transparent',
              }}>
                <MethodTag method={r.method} />
                <span className="mono" style={{ fontSize: 12, color: 'var(--text)', paddingRight: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.endpoint}</span>
                <Badge status={r.status} />
                <span className="mono" style={{ fontSize: 12, color: durationColor(r.duration) }}>{r.duration}ms</span>
                <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>{r.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button onClick={() => onNav('dashboard')} style={{
            background: 'transparent', border: '1px solid var(--border2)',
            color: 'var(--text-muted)', padding: '8px 20px', borderRadius: 'var(--radius)',
            cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all .15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--text-subtle)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border2)' }}>
            Explore the demo dashboard →
          </button>
        </div>
      </section>

      {/* CTA */}
      <section style={{ borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '80px 40px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.8px', margin: '0 0 16px' }}>
            Start debugging in 30 seconds.
          </h2>
          <p style={{ fontSize: 16, color: 'var(--text-muted)', margin: '0 0 40px' }}>
            No account required. No credit card. Runs entirely on your machine.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={() => onNav('dashboard')} style={{
              background: 'var(--blue)', border: 'none', color: '#fff',
              padding: '10px 28px', borderRadius: 'var(--radius)',
              cursor: 'pointer', fontSize: 14, fontWeight: 600, transition: 'background .15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--blue-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--blue)')}>
              Get Started
            </button>
            <a href="https://github.com" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text-muted)',
              padding: '10px 20px', borderRadius: 'var(--radius)',
              cursor: 'pointer', fontSize: 14, fontWeight: 500, textDecoration: 'none', transition: 'all .15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--text-subtle)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border2)' }}>
              <IconGithub /> View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '32px 40px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 20, height: 20, borderRadius: 5, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>N</span>
            </div>
            <span style={{ fontWeight: 600, fontSize: 13 }}>NUMBAT</span>
            <span style={{ color: 'var(--text-subtle)', fontSize: 13 }}>— local-first observability</span>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            {[
              { label: 'GitHub', href: 'https://github.com' },
              { label: 'Docs', href: '#' },
              { label: 'Changelog', href: '#' },
              { label: 'License', href: '#' },
            ].map(l => (
              <a key={l.label} href={l.href} style={{ color: 'var(--text-subtle)', fontSize: 13, textDecoration: 'none', transition: 'color .15s' }}
                onClick={e => { if (l.href === '#') e.preventDefault() }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-subtle)')}>
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}

// ─── Auth Page ────────────────────────────────────────────────────────────────

function AuthPage({ mode, onNav }: { mode: 'login' | 'signup'; onNav: (v: View) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { setError('Please fill in all fields.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setError('')
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onNav('dashboard')
    }, 1200)
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 16px',
    }}>
      {/* Back to marketing */}
      <button onClick={() => onNav('marketing')} style={{
        position: 'absolute', top: 24, left: 24,
        background: 'transparent', border: '1px solid var(--border)',
        color: 'var(--text-muted)', padding: '6px 14px', borderRadius: 'var(--radius)',
        cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, transition: 'all .15s',
      }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border2)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
        ← Back
      </button>

      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: 'var(--blue)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>N</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.4px' }}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
            {mode === 'login' ? "Sign in to your NUMBAT account." : "Monitor your first project in minutes."}
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '32px', boxShadow: 'var(--shadow)',
        }}>
          {/* GitHub */}
          <button style={{
            width: '100%', background: 'var(--surface2)', border: '1px solid var(--border2)',
            color: 'var(--text)', padding: '10px 16px', borderRadius: 'var(--radius)',
            cursor: 'pointer', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8, marginBottom: 24, transition: 'all .15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface3)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface2)')}>
            <IconGithub />
            Continue with GitHub
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
            <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>or continue with email</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text)' }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="sam@acme.dev"
                style={{
                  width: '100%', padding: '9px 12px',
                  background: 'var(--surface2)', border: `1px solid ${error && !email ? 'var(--red)' : 'var(--border2)'}`,
                  borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 14,
                  outline: 'none', transition: 'border-color .15s', boxSizing: 'border-box',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--blue)')}
                onBlur={e => (e.currentTarget.style.borderColor = error && !email ? 'var(--red)' : 'var(--border2)')}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Password</label>
                {mode === 'login' && (
                  <a href="#" onClick={e => e.preventDefault()} style={{ fontSize: 12, color: 'var(--blue)', textDecoration: 'none' }}>Forgot password?</a>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
                style={{
                  width: '100%', padding: '9px 12px',
                  background: 'var(--surface2)', border: `1px solid ${error && !password ? 'var(--red)' : 'var(--border2)'}`,
                  borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 14,
                  outline: 'none', transition: 'border-color .15s', boxSizing: 'border-box',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--blue)')}
                onBlur={e => (e.currentTarget.style.borderColor = error && !password ? 'var(--red)' : 'var(--border2)')}
              />
            </div>

            {error && (
              <div style={{
                padding: '10px 12px', borderRadius: 'var(--radius)',
                background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.2)',
                color: 'var(--red)', fontSize: 13, marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '10px',
              background: loading ? 'var(--blue-hover)' : 'var(--blue)', border: 'none',
              color: '#fff', borderRadius: 'var(--radius)',
              cursor: loading ? 'default' : 'pointer', fontSize: 14, fontWeight: 600,
              transition: 'background .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {loading ? (
                <>
                  <span style={{
                    width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff', borderRadius: '50%',
                    display: 'inline-block', animation: 'spin 0.7s linear infinite',
                  }}/>
                  {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                </>
              ) : (mode === 'login' ? 'Sign in' : 'Create account')}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--text-muted)' }}>
          {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => onNav(mode === 'login' ? 'signup' : 'login')} style={{
            background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer',
            fontSize: 13, padding: 0, fontFamily: 'inherit',
          }}>
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Sidebar({ dashView, setDashView, onNav, errorCount, connected }: {
  dashView: DashView
  setDashView: (v: DashView) => void
  onNav: (v: View) => void
  errorCount?: number
  connected: boolean | null
}) {
  const items: Array<{ id: DashView; label: string; icon: React.ReactNode }> = [
    { id: 'requests', label: 'Requests', icon: <IconActivity /> },
    { id: 'errors', label: 'Errors', icon: <IconAlertTriangle /> },
    { id: 'empty', label: 'Setup', icon: <IconTerminal /> },
  ]

  return (
    <div style={{
      width: 216, flexShrink: 0, borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: 'var(--surface)', position: 'sticky', top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => onNav('marketing')} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit',
          width: '100%',
        }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>N</span>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>NUMBAT</div>
            <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>acme-api</div>
          </div>
        </button>
      </div>

      {/* Nav */}
      <nav style={{ padding: '8px', flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-subtle)', padding: '8px 8px 4px' }}>
          Monitor
        </div>
        {items.map(item => {
          const active = dashView === item.id
          return (
            <button key={item.id} onClick={() => setDashView(item.id)} style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '7px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: active ? 'var(--surface3)' : 'transparent',
              color: active ? 'var(--text)' : 'var(--text-muted)',
              fontSize: 13, fontWeight: active ? 500 : 400,
              transition: 'all .12s', marginBottom: 2, textAlign: 'left',
            }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface2)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
              <span style={{ color: active ? 'var(--blue)' : 'inherit' }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.id === 'errors' && errorCount !== undefined && errorCount > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10,
                  background: 'var(--red-dim)', color: 'var(--red)',
                }}>{errorCount}</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Connection status */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ position: 'relative', width: 8, height: 8 }}>
          <span className="pulse-dot" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: connected ? 'var(--green)' : connected === null ? 'var(--text-subtle)' : 'var(--red)', display: 'block' }}/>
        </div>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>localhost:9000</span>
      </div>
    </div>
  )
}

function Topbar({ dashView, search, setSearch, connected }: { dashView: DashView; search: string; setSearch: (s: string) => void; connected: boolean | null }) {
  const titles: Record<DashView, string> = {
    requests: 'Request Log',
    errors: 'Errors',
    empty: 'Setup',
  }
  return (
    <div style={{
      height: 48, borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16,
      flexShrink: 0, background: 'var(--bg)',
    }}>
      <h1 style={{ fontSize: 14, fontWeight: 600, margin: 0, flex: 1 }}>{titles[dashView]}</h1>
      {dashView === 'requests' && (
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)', pointerEvents: 'none' }}>
            <IconSearch />
          </span>
          <input
            placeholder="Filter by endpoint..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: '6px 10px 6px 30px', width: 220,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 13,
              outline: 'none', fontFamily: 'Inter, system-ui, sans-serif',
              transition: 'border-color .15s',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--blue)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
        </div>
      )}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', background: 'var(--surface)', borderRadius: 6,
        border: '1px solid var(--border)',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? 'var(--green)' : connected === null ? 'var(--text-subtle)' : 'var(--amber)', flexShrink: 0 }}/>
        <span style={{ fontSize: 12, color: connected ? 'var(--text-muted)' : 'var(--amber)' }}>{connected ? 'Connected to localhost' : connected === null ? 'Connecting…' : 'Disconnected'}</span>
      </div>
    </div>
  )
}

// ─── Request Table ────────────────────────────────────────────────────────────

function RequestDetail({ summary, detail, loading, onClose }: { summary: RequestSummary | null; detail: Request | null; loading: boolean; onClose: () => void }) {
  // Hooks must be unconditional — an early return before them would change the
  // hook count between renders and crash React.
  const [tab, setTab] = useState<'overview' | 'headers' | 'request' | 'response'>('overview')
  const [copied, setCopied] = useState(false)
  const [replaying, setReplaying] = useState(false)
  const [curlState, setCurlState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [editing, setEditing] = useState(false)
  const [replayMethod, setReplayMethod] = useState<string>(summary?.method ?? 'GET')
  const [replayHeaders, setReplayHeaders] = useState('')
  const [replayBody, setReplayBody] = useState('')

  if (!summary) return null

  function copy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const req: Request = detail ?? {
    ...summary,
    requestHeaders: {}, responseHeaders: {}, requestBody: null, responseBody: '',
  }
  const bodyMap = { overview: null, headers: null, request: req.requestBody, response: req.responseBody }
  const showCopy = (tab === 'request' && req.requestBody) || tab === 'response'
  const c = statusColor(req.status)

  function toggleEditing() {
    if (editing) {
      setEditing(false)
      return
    }
    setReplayMethod(req.method)
    setReplayHeaders(Object.keys(req.requestHeaders).length > 0 ? JSON.stringify(req.requestHeaders, null, 2) : '')
    setReplayBody(req.requestBody ?? '')
    setEditing(true)
  }

  async function handleReplay() {
    setReplaying(true)
    try {
      let override: ReplayOverride | undefined
      if (editing) {
        override = { method: replayMethod }
        if (replayHeaders.trim() !== '') {
          try {
            override.headers = JSON.parse(replayHeaders) as Record<string, string>
          } catch {
            /* invalid JSON — keep captured headers */
          }
        }
        if (replayBody.trim() !== '') override.body = replayBody
      }
      await replayRequest(summary!.id, override)
    } catch {}
    setTimeout(() => setReplaying(false), 1000)
  }

  async function handleCopyCurl() {
    setCurlState('loading')
    try {
      const curl = await fetchCurl(summary!.id)
      navigator.clipboard.writeText(curl).catch(() => {})
      setCurlState('done')
      setTimeout(() => setCurlState('idle'), 1500)
    } catch {
      setCurlState('idle')
    }
  }

  return (
    <div className="fade-in" style={{
      width: 400, flexShrink: 0, borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--surface)',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <MethodTag method={req.method} />
            <Badge status={req.status} />
          </div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {req.endpoint}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>
              <span className="mono" style={{ color: durationColor(req.duration) }}>{req.duration}ms</span>
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>{timeAgo(req.timestamp)}</span>
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', padding: 4, borderRadius: 4, display: 'flex',
          transition: 'all .12s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}>
          <IconX />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 16px' }}>
        {([['overview', 'Overview'], ['headers', 'Headers'], ['request', 'Body'], ['response', 'Response']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: '10px 12px', background: 'none', border: 'none',
            borderBottom: `2px solid ${tab === id ? 'var(--blue)' : 'transparent'}`,
            color: tab === id ? 'var(--text)' : 'var(--text-muted)',
            cursor: 'pointer', fontSize: 13, fontWeight: tab === id ? 500 : 400,
            marginBottom: -1, transition: 'all .12s',
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[
              ['Method', req.method],
              ['Endpoint', req.endpoint],
              ['Status', `${req.status}`],
              ['Duration', `${req.duration}ms`],
              ['Timestamp', timeAgo(req.timestamp)],
              ['Source', req.source ?? 'default'],
            ].map(([k, v]) => (
              <div key={k} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                padding: '10px 12px', borderRadius: 6, background: 'var(--surface2)',
                marginBottom: 2,
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{k}</span>
                <span className="mono" style={{ fontSize: 12, color: k === 'Status' ? c.text : 'var(--text)', textAlign: 'right', maxWidth: 220, wordBreak: 'break-all' }}>
                  {v}
                </span>
              </div>
            ))}
            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={handleReplay} disabled={replaying} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '9px', background: 'var(--blue-dim)', border: '1px solid rgba(59,130,246,0.2)',
                borderRadius: 'var(--radius)', cursor: replaying ? 'default' : 'pointer', color: 'var(--blue)',
                fontSize: 13, fontWeight: 500, transition: 'all .15s', opacity: replaying ? 0.7 : 1,
              }}
                onMouseEnter={e => { if (!replaying) e.currentTarget.style.background = 'rgba(59,130,246,0.18)' }}
                onMouseLeave={e => { if (!replaying) e.currentTarget.style.background = 'var(--blue-dim)' }}>
                {replaying ? <span className="spin" style={{ display: 'inline-flex', width: 14, height: 14, border: '2px solid rgba(59,130,246,0.3)', borderTopColor: 'var(--blue)', borderRadius: '50%' }} /> : <IconPlay />}
                {replaying ? 'Replaying…' : editing ? 'Replay with edits' : 'Replay Request'}
              </button>
              <button onClick={handleCopyCurl} disabled={curlState === 'loading'} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px', background: 'transparent', border: '1px solid var(--border2)',
                borderRadius: 'var(--radius)', cursor: curlState === 'loading' ? 'default' : 'pointer',
                color: 'var(--text-muted)', fontSize: 13, fontWeight: 500, transition: 'all .15s',
              }}
                onMouseEnter={e => { if (curlState !== 'loading') { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--text-subtle)' } }}
                onMouseLeave={e => { if (curlState !== 'loading') { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border2)' } }}>
                <IconCopy /> {curlState === 'done' ? 'Copied!' : 'Copy cURL'}
              </button>
            </div>

            {/* Customize before replay */}
            <button onClick={toggleEditing} style={{
              marginTop: 8, background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-subtle)', fontSize: 12, padding: '4px 0', textAlign: 'left',
              transition: 'color .12s',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-subtle)')}>
              {editing ? '− Hide editor' : '+ Customize before replay'}
            </button>

            {editing && (
              <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Method</div>
                  <select value={replayMethod} onChange={e => setReplayMethod(e.target.value)} style={{
                    width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 12,
                    padding: '7px 10px', outline: 'none',
                  }}>
                    {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Headers (JSON)</div>
                  <textarea
                    value={replayHeaders}
                    onChange={e => setReplayHeaders(e.target.value)}
                    rows={4}
                    spellCheck={false}
                    placeholder={'{\n  "x-custom": "value"\n}'}
                    className="mono"
                    style={{
                      width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 12, lineHeight: 1.6,
                      padding: '8px 10px', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Body</div>
                  <textarea
                    value={replayBody}
                    onChange={e => setReplayBody(e.target.value)}
                    rows={4}
                    spellCheck={false}
                    placeholder={'{\n  "key": "value"\n}'}
                    className="mono"
                    style={{
                      width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 12, lineHeight: 1.6,
                      padding: '8px 10px', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {tab !== 'overview' && loading && (
          <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="skeleton" style={{ height: 36, borderRadius: 6 }} />
            <div className="skeleton" style={{ height: 36, borderRadius: 6 }} />
            <div className="skeleton" style={{ height: 120, borderRadius: 6 }} />
          </div>
        )}

        {tab === 'headers' && !loading && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Request Headers</div>
              {Object.entries(req.requestHeaders).map(([k, v]) => (
                <div key={k} style={{
                  padding: '8px 10px', borderRadius: 5, background: 'var(--surface2)', marginBottom: 2,
                }}>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--blue)', marginBottom: 2 }}>{k}</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all' }}>{v}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Response Headers</div>
              {Object.entries(req.responseHeaders).map(([k, v]) => (
                <div key={k} style={{
                  padding: '8px 10px', borderRadius: 5, background: 'var(--surface2)', marginBottom: 2,
                }}>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--green)', marginBottom: 2 }}>{k}</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(tab === 'request' || tab === 'response') && !loading && (
          <div>
            {showCopy && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <button onClick={() => copy(tab === 'request' ? (req.requestBody || '') : req.responseBody)} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', borderRadius: 5, background: 'transparent',
                  border: '1px solid var(--border2)', color: 'var(--text-muted)',
                  cursor: 'pointer', fontSize: 12, transition: 'all .12s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--text-subtle)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border2)' }}>
                  <IconCopy /> {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}
            {(tab === 'request' && !req.requestBody) ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-subtle)', fontSize: 13 }}>No request body</div>
            ) : (
              <pre className="mono" style={{
                background: 'var(--surface2)', borderRadius: 6,
                padding: '12px', margin: 0, fontSize: 12, color: 'var(--text)',
                overflow: 'auto', lineHeight: 1.7, whiteSpace: 'pre',
              }}>
                {tab === 'request' ? req.requestBody : req.responseBody}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function RequestsView({ search, setSearch }: { search: string; setSearch: (s: string) => void }) {
  const [requests, setRequests] = useState<RequestSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Request | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | '2xx' | '4xx' | '5xx'>('all')

  useEffect(() => {
    let alive = true
    fetchRequests()
      .then(res => { if (alive) { setRequests(res.requests); setLoading(false) } })
      .catch(() => { if (alive) setLoading(false) })
    const off = onNewRequest(r => {
      setRequests(prev => [r, ...prev.filter(x => x.id !== r.id)].slice(0, 1000))
    })
    return () => { alive = false; off() }
  }, [])

  useEffect(() => {
    if (!selectedId) { setDetail(null); return }
    let alive = true
    setDetailLoading(true)
    fetchRequest(selectedId)
      .then(res => { if (alive) setDetail(res.request) })
      .catch(() => {})
      .finally(() => { if (alive) setDetailLoading(false) })
    return () => { alive = false }
  }, [selectedId])

  const summary = selectedId ? requests.find(r => r.id === selectedId) ?? null : null

  const filtered = requests
    .filter((r): r is RequestSummary => r != null && typeof r.endpoint === 'string' && typeof r.status === 'number')
    .filter(r => {
      const matchSearch = r.endpoint.toLowerCase().includes(search.toLowerCase())
      const matchFilter = filter === 'all' || (filter === '2xx' && r.status < 300) || (filter === '4xx' && r.status >= 400 && r.status < 500) || (filter === '5xx' && r.status >= 500)
      return matchSearch && matchFilter
    })

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Sub-toolbar */}
        <div style={{
          padding: '8px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
        }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)', pointerEvents: 'none' }}>
              <IconSearch />
            </span>
            <input
              placeholder="Filter by endpoint..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                padding: '6px 10px 6px 30px', width: 260,
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 13,
                outline: 'none', fontFamily: 'Inter, system-ui, sans-serif',
                transition: 'border-color .15s',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--blue)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', '2xx', '4xx', '5xx'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '5px 10px', borderRadius: 6, border: 'none',
                cursor: 'pointer', fontSize: 12, fontWeight: 500,
                background: filter === f ? 'var(--surface3)' : 'transparent',
                color: filter === f ? 'var(--text)' : 'var(--text-muted)',
                transition: 'all .12s',
              }}>
                {f}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-subtle)' }}>
            {filtered.length} request{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {/* Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '80px 1fr 72px 88px 104px',
            padding: '8px 24px', borderBottom: '1px solid var(--border)',
            position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10,
          }}>
            {['Method', 'Endpoint', 'Status', 'Duration', 'Timestamp'].map(h => (
              <span key={h} style={{
                fontSize: 11, color: 'var(--text-subtle)', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>{h}</span>
            ))}
          </div>

          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '80px 1fr 72px 88px 104px',
                padding: '12px 24px', borderBottom: '1px solid var(--border)', alignItems: 'center', gap: 8,
              }}>
                <div className="skeleton" style={{ height: 18, width: 44 }}/>
                <div className="skeleton" style={{ height: 14, width: `${120 + Math.random() * 120}px` }}/>
                <div className="skeleton" style={{ height: 18, width: 36 }}/>
                <div className="skeleton" style={{ height: 14, width: 40 }}/>
                <div className="skeleton" style={{ height: 14, width: 56 }}/>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div style={{ padding: '64px 24px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: 13 }}>
              No requests match your filter.
            </div>
          ) : (
            filtered.map(r => {
              const isSelected = selectedId === r.id
              return (
                <div key={r.id} onClick={() => setSelectedId(isSelected ? null : r.id)} style={{
                  display: 'grid', gridTemplateColumns: '80px 1fr 72px 88px 104px',
                  padding: '11px 24px', borderBottom: '1px solid var(--border)', alignItems: 'center',
                  cursor: 'pointer', transition: 'background .1s',
                  background: isSelected ? 'var(--surface)' : 'transparent',
                  borderLeft: isSelected ? `2px solid var(--blue)` : '2px solid transparent',
                }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface2)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}>
                  <MethodTag method={r.method} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, paddingRight: 8 }}>
                      {r.endpoint}
                    </span>
                    {r.source && r.source !== 'default' && (
                      <span style={{
                        flexShrink: 0, fontSize: 10, fontWeight: 500, padding: '1px 6px',
                        borderRadius: 4, background: 'var(--blue-dim)', color: 'var(--blue)',
                        whiteSpace: 'nowrap',
                      }}>{r.source}</span>
                    )}
                  </div>
                  <Badge status={r.status} />
                  <span className="mono" style={{ fontSize: 12, color: durationColor(r.duration) }}>{r.duration}ms</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>{timeAgo(r.timestamp)}</span>
                    <span style={{ color: 'var(--text-subtle)', opacity: isSelected ? 1 : 0, transition: 'opacity .1s' }}>
                      <IconChevronRight />
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {selectedId && (
        <RequestDetail summary={summary} detail={detail} loading={detailLoading} onClose={() => setSelectedId(null)} />
      )}
    </div>
  )
}

// ─── Errors View ──────────────────────────────────────────────────────────────

function ErrorsView({ onCountChange }: { onCountChange: (n: number) => void }) {
  const [errors, setErrors] = useState<AppError[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetchErrors()
      .then(res => { if (alive) setErrors(res.errors.map(e => ({ ...e, expanded: false }))) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    const off = onNewError(g => {
      setErrors(prev => {
        const idx = prev.findIndex(e => e.id === g.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...prev[idx], count: g.count, lastSeen: g.lastSeen, stack: g.stack }
          return next
        }
        return [{ ...g, expanded: false }, ...prev]
      })
    })
    return () => { alive = false; off() }
  }, [])

  useEffect(() => {
    onCountChange(errors.length)
  }, [errors, onCountChange])

  function toggle(id: string) {
    setErrors(prev => prev.map(e => e.id === id ? { ...e, expanded: !e.expanded } : e))
  }

  async function handleResolve(id: string) {
    try { await resolveError(id) } catch {}
    setErrors(prev => prev.filter(e => e.id !== id))
  }

  function handleCopyTrace(e: AppError) {
    navigator.clipboard.writeText(e.stack.join('\n')).catch(() => {})
  }

  const totalCount = errors.reduce((n, e) => n + e.count, 0)
  const files = new Set(errors.map(e => e.file)).size

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {loading ? (
          [0, 1, 2].map(i => (
            <div key={i} style={{
              padding: '20px 24px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            }}>
              <div className="skeleton" style={{ height: 14, width: 80, marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 28, width: 40, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 12, width: 60 }} />
            </div>
          ))
        ) : (
          [
            { label: 'Total Errors', value: String(totalCount), delta: `${errors.length} open issue${errors.length !== 1 ? 's' : ''}`, color: 'var(--red)' },
            { label: 'Unique Issues', value: String(errors.length), delta: 'this session', color: 'var(--amber)' },
            { label: 'Affected Endpoints', value: String(files), delta: `across ${files} file${files !== 1 ? 's' : ''}`, color: 'var(--text-muted)' },
          ].map(s => (
            <div key={s.label} style={{
              padding: '20px 24px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color, letterSpacing: '-0.5px', marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>{s.delta}</div>
            </div>
          ))
        )}
      </div>

      {/* Error list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1].map(i => (
            <div key={i} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '20px',
              borderLeft: '3px solid var(--surface2)',
            }}>
              <div className="skeleton" style={{ height: 16, width: '40%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 14, width: '70%' }} />
            </div>
          ))}
        </div>
      ) : errors.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-subtle)', fontSize: 13 }}>No errors captured yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {errors.map(err => (
            <div key={err.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', overflow: 'hidden',
              borderLeft: `3px solid var(--red)`,
            }}>
              <button onClick={() => toggle(err.id)} style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '16px 20px', background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left', transition: 'background .12s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <span style={{ color: 'var(--text-muted)', transform: err.expanded ? 'rotate(90deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }}>
                  <IconChevronRight />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                    <span className="mono" style={{ fontSize: 13, fontWeight: 500, color: 'var(--red)' }}>{err.type}</span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{err.file}:{err.line}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {err.message}
                  </div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{
                    padding: '2px 8px', borderRadius: 4, background: 'var(--red-dim)',
                    color: 'var(--red)', fontSize: 11, fontWeight: 600, marginBottom: 4,
                  }}>×{err.count}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{timeAgo(err.lastSeen)}</div>
                </div>
              </button>

              {err.expanded && (
                <div className="fade-in" style={{ borderTop: '1px solid var(--border)', padding: '16px 20px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                    Stack Trace
                  </div>
                  <pre className="mono" style={{
                    background: 'var(--surface2)', borderRadius: 6,
                    padding: '12px 16px', margin: 0, fontSize: 12, lineHeight: 1.8,
                    overflow: 'auto', color: 'var(--text)',
                  }}>
                    {err.stack.map((line, i) => (
                      <div key={i} style={{
                        color: i === 0 ? 'var(--red)' : i === 1 ? 'var(--text)' : 'var(--text-subtle)',
                        fontWeight: i <= 1 ? 500 : 400,
                      }}>{line}</div>
                    ))}
                  </pre>
                  <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <button onClick={() => handleResolve(err.id)} style={{
                      padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border2)',
                      background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                      fontSize: 12, fontWeight: 500, transition: 'all .12s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--text-subtle)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border2)' }}>
                      Mark Resolved
                    </button>
                    <button onClick={() => handleCopyTrace(err)} style={{
                      padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border2)',
                      background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                      fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, transition: 'all .12s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--text-subtle)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border2)' }}>
                      <IconCopy /> Copy Trace
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Empty / Setup State ──────────────────────────────────────────────────────

function EmptyState() {
  const [copied, setCopied] = useState<string | null>(null)

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  const steps: Array<{ num: string; title: string; code: string; desc: string }> = [
    { num: '01', title: 'Install NUMBAT', code: 'npm install -g numbat', desc: 'Requires Node.js 18 or later.' },
    { num: '02', title: 'Start the agent', code: 'numbat start', desc: 'Run this in your project root. Binds to localhost:9000.' },
    { num: '03', title: 'Point your app at it', code: 'NUMBAT_PROXY=http://localhost:9000', desc: 'Add this env var and restart your dev server.' },
  ]

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '40px 24px',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12, background: 'var(--surface)',
        border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', marginBottom: 24, color: 'var(--text-muted)',
      }}>
        <IconEye />
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.3px', textAlign: 'center' }}>
        No requests captured yet.
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 40px', textAlign: 'center', maxWidth: 360, lineHeight: 1.6 }}>
        Connect NUMBAT to your app and requests will appear here in real time.
      </p>

      <div style={{ width: '100%', maxWidth: 540, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {steps.map(s => (
          <div key={s.num} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '20px 24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-subtle)', letterSpacing: '0.05em', flexShrink: 0, paddingTop: 1 }}>{s.num}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{s.title}</div>
                <div style={{ position: 'relative' }}>
                  <pre className="mono" style={{
                    background: 'var(--surface2)', padding: '10px 40px 10px 14px',
                    borderRadius: 6, margin: '0 0 8px', fontSize: 12, color: 'var(--blue)',
                    border: '1px solid var(--border)', whiteSpace: 'pre', overflow: 'auto',
                  }}>
                    {s.code}
                  </pre>
                  <button onClick={() => copy(s.code, s.num)} style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    padding: '4px 6px', background: 'transparent', border: 'none',
                    cursor: 'pointer', color: copied === s.num ? 'var(--green)' : 'var(--text-subtle)',
                    borderRadius: 4, transition: 'color .12s',
                  }}>
                    <IconCopy />
                  </button>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{s.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p style={{ marginTop: 32, fontSize: 13, color: 'var(--text-subtle)' }}>
        Need help?{' '}
        <a href="https://github.com" style={{ color: 'var(--blue)', textDecoration: 'none' }}>Read the docs →</a>
      </p>
    </div>
  )
}

// ─── Dashboard Shell ──────────────────────────────────────────────────────────

function Dashboard({ onNav }: { onNav: (v: View) => void }) {
  const [dashView, setDashView] = useState<DashView>(() => {
    const saved = sessionStorage.getItem('numbat.dashview')
    return saved === 'requests' || saved === 'errors' || saved === 'empty' ? (saved as DashView) : 'requests'
  })
  const [search, setSearch] = useState('')
  const [errorCount, setErrorCount] = useState(0)
  const [connected, setConnected] = useState<boolean | null>(null)

  useEffect(() => onConnectionChange(setConnected), [])
  useEffect(() => {
    sessionStorage.setItem('numbat.dashview', dashView)
  }, [dashView])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      <Sidebar dashView={dashView} setDashView={setDashView} onNav={onNav} errorCount={errorCount} connected={connected} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar dashView={dashView} search={search} setSearch={setSearch} connected={connected} />
        {dashView === 'requests' && <RequestsView search={search} setSearch={setSearch} />}
        {dashView === 'errors' && <ErrorsView onCountChange={setErrorCount} />}
        {dashView === 'empty' && <EmptyState />}
      </div>
    </div>
  )
}

// ─── App Root ─────────────────────────────────────────────────────────────────

/**
 * Trap uncaught errors / rejections BEFORE a full-page reload wipes them, so
 * the next load can surface the cause. Reloads are invisible in sessionStorage.
 */
function installCrashTrap(): void {
  window.addEventListener('error', (e) => {
    const msg = e.message || 'Unknown error'
    try { sessionStorage.setItem('numbat.crash', msg) } catch { /* ignore */ }
    console.error('[numbat] uncaught error:', e.error ?? e.message)
  })
  window.addEventListener('unhandledrejection', (e) => {
    const msg = e.reason instanceof Error ? e.reason.message : String(e.reason)
    try { sessionStorage.setItem('numbat.crash', msg) } catch { /* ignore */ }
    console.error('[numbat] unhandled rejection:', e.reason)
  })
}

/** Amber banner shown after a crash was recorded on a previous load. */
function CrashBanner() {
  const [message, setMessage] = useState<string | null>(() => {
    try { return sessionStorage.getItem('numbat.crash') } catch { return null }
  })
  if (!message) return null
  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 1000, maxWidth: 420,
      background: 'var(--surface)', border: '1px solid var(--amber)',
      borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
      padding: '12px 14px', fontSize: 12, color: 'var(--text)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ color: 'var(--amber)', fontWeight: 600 }}>⚠ A crash was caught</span>
        <button onClick={() => { try { sessionStorage.removeItem('numbat.crash') } catch {} setMessage(null) }} style={{
          marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)',
          cursor: 'pointer', padding: 2,
        }}>✕</button>
      </div>
      <div className="mono" style={{ color: 'var(--text-muted)', wordBreak: 'break-all' }}>{message}</div>
    </div>
  )
}

/**
 * Catches render errors so a single component crash can never unmount the
 * whole app (which looks like a bounce back to the landing page). Shows the
 * error message on screen instead of failing silently.
 */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('[numbat] render error:', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
          background: 'var(--bg)', color: 'var(--text)', padding: 40, textAlign: 'center',
        }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Something went wrong</div>
          <pre className="mono" style={{
            fontSize: 12, color: 'var(--red)', maxWidth: 640, maxHeight: 240,
            overflow: 'auto', textAlign: 'left', background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 8, padding: 16,
          }}>
            {this.state.error.message}
            {'\n'}{this.state.error.stack}
          </pre>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => this.setState({ error: null })} style={{
              padding: '8px 18px', borderRadius: 'var(--radius)', cursor: 'pointer',
              background: 'var(--blue)', border: 'none', color: '#fff',
              fontSize: 13, fontWeight: 600,
            }}>
              Try again
            </button>
            <button onClick={() => window.location.reload()} style={{
              padding: '8px 18px', borderRadius: 'var(--radius)', cursor: 'pointer',
              background: 'transparent', border: '1px solid var(--border2)',
              color: 'var(--text-muted)', fontSize: 13, fontWeight: 500,
            }}>
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  // Persist the current view so a full-page reload (dev-server restart, HMR
  // full-reload, preview harness refresh) returns you to where you were
  // instead of bouncing to the landing page.
  const [view, setView] = useState<View>(() => {
    const saved = sessionStorage.getItem('numbat.view')
    return saved === 'login' || saved === 'signup' || saved === 'dashboard' ? (saved as View) : 'marketing'
  })
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')

  useEffect(() => {
    sessionStorage.setItem('numbat.view', view)
  }, [view])

  function handleNav(v: View) {
    if (v === 'login') { setAuthMode('login'); setView('login') }
    else if (v === 'signup') { setAuthMode('signup'); setView('signup') }
    else setView(v)
  }

  let page: ReactNode
  if (view === 'marketing') page = <MarketingPage onNav={handleNav} />
  else if (view === 'login' || view === 'signup') page = <AuthPage mode={authMode} onNav={handleNav} />
  else if (view === 'dashboard') page = <Dashboard onNav={handleNav} />
  else page = null

  useEffect(() => {
    installCrashTrap()
  }, [])

  return (
    <>
      <ErrorBoundary>{page}</ErrorBoundary>
      <CrashBanner />
    </>
  )
}
