import { useState } from 'react';
import { Layers, Users, DollarSign, RefreshCw, Eye, Settings2 } from 'lucide-react';

const tables = [
  {
    id: '1',
    name: 'Table #1',
    type: 'Texas Holdem',
    stakes: '$1/$2',
    players: 6,
    maxPlayers: 9,
    status: 'active',
    pot: 450,
    dealer: 3,
  },
  {
    id: '2',
    name: 'Table #2',
    type: 'Texas Holdem',
    stakes: '$2/$5',
    players: 8,
    maxPlayers: 9,
    status: 'active',
    pot: 1200,
    dealer: 7,
  },
  {
    id: '3',
    name: 'Table #3',
    type: 'Omaha',
    stakes: '$5/$10',
    players: 5,
    maxPlayers: 6,
    status: 'active',
    pot: 890,
    dealer: 2,
  },
  {
    id: '4',
    name: 'VIP Room #1',
    type: 'Texas Holdem',
    stakes: '$25/$50',
    players: 4,
    maxPlayers: 6,
    status: 'active',
    pot: 8500,
    dealer: 1,
  },
  {
    id: '5',
    name: 'Table #4',
    type: 'Texas Holdem',
    stakes: '$1/$2',
    players: 0,
    maxPlayers: 9,
    status: 'empty',
    pot: 0,
    dealer: 0,
  },
  {
    id: '6',
    name: 'Table #5',
    type: 'Seven Card Stud',
    stakes: '$2/$4',
    players: 3,
    maxPlayers: 8,
    status: 'active',
    pot: 120,
    dealer: 5,
  },
  {
    id: '7',
    name: 'Table #6',
    type: 'Texas Holdem',
    stakes: '$0.5/$1',
    players: 9,
    maxPlayers: 9,
    status: 'full',
    pot: 280,
    dealer: 4,
  },
  {
    id: '8',
    name: 'Private Room',
    type: 'Omaha',
    stakes: '$10/$20',
    players: 0,
    maxPlayers: 6,
    status: 'reserved',
    pot: 0,
    dealer: 0,
  },
];

const seats = Array.from({ length: 9 }, (_, i) => i);

export default function TablesPage() {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  // viewMode for future list/grid toggle feature
  const [_viewMode, _setViewMode] = useState<'grid' | 'list'>('grid');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'full':
        return 'bg-yellow-500';
      case 'empty':
        return 'bg-gray-500';
      case 'reserved':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Tables</h1>
          <p className="text-gray-500">Monitor and manage active game tables</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary">
            <RefreshCw className="w-4 h-4 mr-2 inline" />
            Refresh
          </button>
          <button className="btn-primary">
            <Layers className="w-4 h-4 mr-2 inline" />
            Create Table
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-poker-card border border-poker-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <Layers className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-white">
                {tables.filter((t) => t.status === 'active').length}
              </p>
              <p className="text-sm text-gray-500">Active Tables</p>
            </div>
          </div>
        </div>
        <div className="bg-poker-card border border-poker-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-white">
                {tables.reduce((sum, t) => sum + t.players, 0)}
              </p>
              <p className="text-sm text-gray-500">Players Online</p>
            </div>
          </div>
        </div>
        <div className="bg-poker-card border border-poker-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-white">
                ${tables.reduce((sum, t) => sum + t.pot, 0).toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">Total in Pots</p>
            </div>
          </div>
        </div>
        <div className="bg-poker-card border border-poker-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Layers className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-white">
                {tables.filter((t) => t.status === 'full').length}
              </p>
              <p className="text-sm text-gray-500">Full Tables</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {tables.map((table) => (
          <div
            key={table.id}
            className={`bg-poker-card border rounded-xl p-6 card-hover cursor-pointer ${
              selectedTable === table.id
                ? 'border-cyan-500'
                : 'border-poker-border'
            }`}
            onClick={() => setSelectedTable(table.id)}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-white">{table.name}</h3>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${getStatusColor(table.status)}`} />
                <span className="text-sm text-gray-400 capitalize">{table.status}</span>
              </div>
            </div>

            {/* Poker Table Visualization */}
            <div className="relative w-full aspect-[4/3] mb-4">
              {/* Table felt */}
              <div className="absolute inset-4 bg-poker-felt rounded-full border-4 border-amber-900 shadow-inner">
                {/* Pot display */}
                {table.pot > 0 && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/50 px-3 py-1 rounded-full">
                    <span className="text-yellow-400 font-display font-bold text-sm">
                      ${table.pot}
                    </span>
                  </div>
                )}
              </div>

              {/* Seats */}
              {seats.slice(0, table.maxPlayers).map((seat, index) => {
                const angle = (index / table.maxPlayers) * 2 * Math.PI - Math.PI / 2;
                const x = 50 + 40 * Math.cos(angle);
                const y = 50 + 40 * Math.sin(angle);
                const isOccupied = index < table.players;
                const isDealer = index === table.dealer - 1;

                return (
                  <div
                    key={seat}
                    className={`absolute w-6 h-6 rounded-full -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-xs font-bold ${
                      isOccupied
                        ? 'bg-gradient-to-br from-cyan-500 to-purple-600 text-white'
                        : 'bg-poker-darker border border-poker-border text-gray-600'
                    }`}
                    style={{ left: `${x}%`, top: `${y}%` }}
                  >
                    {isDealer && isOccupied && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full text-[8px] text-black flex items-center justify-center">
                        D
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Info */}
            <div className="grid grid-cols-3 gap-2 text-center mb-4">
              <div>
                <p className="text-xs text-gray-500">Type</p>
                <p className="text-sm text-white truncate">{table.type}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Stakes</p>
                <p className="text-sm text-white">{table.stakes}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Players</p>
                <p className="text-sm text-white">
                  {table.players}/{table.maxPlayers}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button className="btn-secondary flex-1 py-2 text-sm">
                <Eye className="w-4 h-4 mr-1 inline" />
                View
              </button>
              <button className="btn-secondary flex-1 py-2 text-sm">
                <Settings2 className="w-4 h-4 mr-1 inline" />
                Manage
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

