import { useState } from 'react';
import {
  Trophy,
  Plus,
  Calendar,
  Users,
  DollarSign,
  Play,
  Pause,
  X,
} from 'lucide-react';

const tournaments = [
  {
    id: '1',
    name: 'Sunday Million',
    status: 'running',
    buyIn: 100,
    prizePool: 50000,
    players: 487,
    maxPlayers: 500,
    startTime: '2024-03-17 14:00',
    type: 'Texas Holdem',
  },
  {
    id: '2',
    name: 'Daily Freeroll',
    status: 'registering',
    buyIn: 0,
    prizePool: 1000,
    players: 234,
    maxPlayers: 1000,
    startTime: '2024-03-17 18:00',
    type: 'Texas Holdem',
  },
  {
    id: '3',
    name: 'High Roller Championship',
    status: 'scheduled',
    buyIn: 500,
    prizePool: 100000,
    players: 0,
    maxPlayers: 200,
    startTime: '2024-03-20 20:00',
    type: 'Texas Holdem',
  },
  {
    id: '4',
    name: 'Omaha Masters',
    status: 'running',
    buyIn: 50,
    prizePool: 15000,
    players: 298,
    maxPlayers: 300,
    startTime: '2024-03-17 12:00',
    type: 'Omaha',
  },
  {
    id: '5',
    name: 'Beginner Special',
    status: 'completed',
    buyIn: 10,
    prizePool: 5000,
    players: 500,
    maxPlayers: 500,
    startTime: '2024-03-16 16:00',
    type: 'Texas Holdem',
  },
];

export default function TournamentsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState('all');

  const filteredTournaments = tournaments.filter(
    (t) => filter === 'all' || t.status === filter
  );

  const statusColors = {
    running: 'bg-green-500',
    registering: 'bg-yellow-500',
    scheduled: 'bg-cyan-500',
    completed: 'bg-gray-500',
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Tournaments</h1>
          <p className="text-gray-500">Manage poker tournaments and events</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <Plus className="w-4 h-4 mr-2 inline" />
          Create Tournament
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'running', 'registering', 'scheduled', 'completed'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              filter === status
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-poker-card text-gray-400 hover:text-white border border-poker-border'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Tournament Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTournaments.map((tournament) => (
          <div
            key={tournament.id}
            className="bg-poker-card border border-poker-border rounded-xl p-6 card-hover"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 rounded-lg flex items-center justify-center border border-yellow-500/30">
                  <Trophy className="w-6 h-6 text-yellow-400" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-white">
                    {tournament.name}
                  </h3>
                  <p className="text-sm text-gray-500">{tournament.type}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${statusColors[tournament.status as keyof typeof statusColors]}`}
                />
                <span className="text-sm text-gray-400 capitalize">
                  {tournament.status}
                </span>
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-xs text-gray-500">Buy-in</p>
                  <p className="font-display font-bold text-white">
                    {tournament.buyIn === 0 ? 'Free' : `$${tournament.buyIn}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-xs text-gray-500">Prize Pool</p>
                  <p className="font-display font-bold text-green-400">
                    ${tournament.prizePool.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-xs text-gray-500">Players</p>
                  <p className="font-display font-bold text-white">
                    {tournament.players}/{tournament.maxPlayers}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-xs text-gray-500">Start Time</p>
                  <p className="text-sm text-white">{tournament.startTime}</p>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="h-2 bg-poker-darker rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-purple-600"
                  style={{
                    width: `${(tournament.players / tournament.maxPlayers) * 100}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {Math.round((tournament.players / tournament.maxPlayers) * 100)}% filled
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {tournament.status === 'running' ? (
                <>
                  <button className="btn-secondary flex-1 py-2 text-sm">
                    <Pause className="w-4 h-4 mr-1 inline" />
                    Pause
                  </button>
                  <button className="btn-danger flex-1 py-2 text-sm">
                    <X className="w-4 h-4 mr-1 inline" />
                    Cancel
                  </button>
                </>
              ) : tournament.status === 'registering' ? (
                <>
                  <button className="btn-primary flex-1 py-2 text-sm">
                    <Play className="w-4 h-4 mr-1 inline" />
                    Start
                  </button>
                  <button className="btn-secondary flex-1 py-2 text-sm">Edit</button>
                </>
              ) : tournament.status === 'scheduled' ? (
                <button className="btn-secondary w-full py-2 text-sm">Edit</button>
              ) : (
                <button className="btn-secondary w-full py-2 text-sm">
                  View Results
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create Tournament Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-poker-card border border-poker-border rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-display font-bold text-white">
                Create Tournament
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 rounded-lg hover:bg-poker-darker text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Tournament Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Sunday Million"
                  className="input-field"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Buy-in ($)</label>
                  <input type="number" placeholder="100" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Max Players
                  </label>
                  <input type="number" placeholder="500" className="input-field" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Game Type</label>
                <select className="input-field">
                  <option>Texas Holdem</option>
                  <option>Omaha</option>
                  <option>Seven Card Stud</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Start Time</label>
                <input type="datetime-local" className="input-field" />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Create Tournament
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

