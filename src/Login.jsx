import React, { useState } from 'react';
import palantirLogo from './assets/palantir-logo.svg';

export default function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Shared password logic - ideally this would be an environment variable
    if (password === 'yosemite2026') {
      onLogin();
    } else {
      setError(true);
      setPassword('');
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[#0d1117] text-[#C9D1D9] font-sans antialiased">
        <div className="relative w-full max-w-md p-8 border border-[#30363D] bg-[#161b22] shadow-2xl">
            <div className="flex justify-center mb-8">
                 <img
                    src={palantirLogo}
                    alt="Palantir"
                    className="h-8 w-auto opacity-90"
                    style={{ filter: 'invert(1) grayscale(1) brightness(1.15)' }}
                />
            </div>
            
            <div className="space-y-6">
                <div className="text-center">
                    <h1 className="text-xl font-black uppercase tracking-[0.2em] text-[#58A6FF]">Command Center</h1>
                    <p className="mt-2 text-xs text-[#8B949E] uppercase tracking-widest">Restricted Access // Family Only</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="ENTER ACCESS KEY"
                            className="w-full rounded-[2px] border border-[#30363D] bg-[#0d1117] px-4 py-3 text-sm font-mono tracking-widest outline-none focus:border-[#58A6FF] transition-all"
                            autoFocus
                        />
                        {error && (
                            <p className="mt-2 text-[10px] font-bold text-[#F85149] uppercase tracking-widest text-center">Invalid access key</p>
                        )}
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-[#58A6FF]/10 border border-[#58A6FF]/30 py-3 text-xs font-black uppercase tracking-[0.3em] text-[#58A6FF] hover:bg-[#58A6FF]/20 hover:border-[#58A6FF] transition-all"
                    >
                        Authenticate
                    </button>
                </form>
            </div>
            
            <div className="mt-12 pt-6 border-t border-[#30363D]/50 text-center">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#3FB950]">
                    UNCLASSIFIED // FAMILY OPS
                </div>
            </div>
        </div>
    </div>
  );
}
