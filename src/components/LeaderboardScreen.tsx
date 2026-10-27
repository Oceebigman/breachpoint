import { ArrowLeft, Trophy } from 'lucide-react';

interface Props {
  onBack: () => void;
}

// Personal bests stored in localStorage (practice only, not server-validated)
interface LocalRecord {
  kills: number;
  date: string;
  botDifficulty: string;
}

function getLocalRecords(): LocalRecord[] {
  try {
    const raw = localStorage.getItem('bp_local_records');
    return raw ? (JSON.parse(raw) as LocalRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalRecord(kills: number, botDifficulty: string) {
  const records = getLocalRecords();
  records.push({ kills, date: new Date().toLocaleDateString(), botDifficulty });
  records.sort((a, b) => b.kills - a.kills);
  localStorage.setItem('bp_local_records', JSON.stringify(records.slice(0, 10)));
}

export function LeaderboardScreen({ onBack }: Props) {
  const records = getLocalRecords();

  return (
    <div className="min-h-dvh bg-[#0d1117] flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onBack}
            className="p-2 border border-[#2a3040] text-[#8899aa] hover:border-[#f5a623] hover:text-white rounded-sm transition-all"
          >
            <ArrowLeft size={16} />
          </button>
          <h2 className="text-white font-bold text-xl tracking-wider" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
            LEADERBOARDS
          </h2>
        </div>

        <div className="p-4 border border-[#f5a62344] bg-[#f5a62308] rounded-sm mb-4">
          <div className="flex items-center gap-2 text-[#f5a623] text-xs font-mono tracking-widest mb-1">
            <Trophy size={12} /> PERSONAL BEST — BREACH PRACTICE
          </div>
          <p className="text-[#8899aa] text-xs">
            Practice scores are personal records only. Ranked competitive leaderboards are coming in Phase 4
            (server-validated, anti-farming, idempotent results).
          </p>
        </div>

        {records.length === 0 ? (
          <div className="text-center py-12 border border-[#2a3040] rounded-sm">
            <div className="text-[#3a4050] text-5xl mb-3 flex justify-center">
              <Trophy size={48} strokeWidth={1} />
            </div>
            <div className="text-[#5a6a7a] text-sm font-mono">No records yet</div>
            <div className="text-[#3a4050] text-xs font-mono mt-1">Complete a practice match to record a score</div>
          </div>
        ) : (
          <div className="border border-[#2a3040] rounded-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#1a1d24]">
                <tr>
                  {['#', 'KILLS', 'DIFFICULTY', 'DATE'].map(h => (
                    <th key={h} className="py-2 px-3 text-xs font-mono tracking-wider text-[#5a6a7a] text-center first:text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i} className={`border-t border-[#1a1d24] ${i === 0 ? 'bg-[#f5a62308]' : ''}`}>
                    <td className="py-2 px-3 font-mono text-[#5a6a7a]">{i + 1}</td>
                    <td className="py-2 px-3 font-mono tabular-nums text-white text-center">{r.kills}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`text-xs font-mono px-1.5 py-0.5 rounded-sm ${
                        r.botDifficulty === 'hard' ? 'bg-[#e8485520] text-[#e84855]' :
                        r.botDifficulty === 'normal' ? 'bg-[#f5a62320] text-[#f5a623]' :
                        'bg-[#44cc8820] text-[#44cc88]'
                      }`}>
                        {r.botDifficulty.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-[#5a6a7a] text-xs font-mono text-center">{r.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Mode-specific placeholders */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {['RANKED BREACH', 'RANKED CONTROL', 'TEAM DEATHMATCH', 'FREE-FOR-ALL'].map(m => (
            <div key={m} className="p-3 border border-[#1a1d24] rounded-sm text-center opacity-40">
              <div className="text-xs font-mono text-[#5a6a7a] tracking-wider">{m}</div>
              <div className="text-[#3a4050] text-xs font-mono mt-1">Coming in Phase 4</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
