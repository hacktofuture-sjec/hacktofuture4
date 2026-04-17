import { useState } from 'react';
import { useCattleStore, CowStatus } from '../store/cattleStore';
import { Plus, Search, Tag, CheckCircle, AlertCircle, Eye } from 'lucide-react';

const statusColors: Record<CowStatus, string> = {
  Heat: 'bg-red-100 text-red-700 border-red-200',
  Monitor: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Healthy: 'bg-green-100 text-green-700 border-green-200',
};

const statusDot: Record<CowStatus, string> = {
  Heat: 'bg-red-500',
  Monitor: 'bg-yellow-500',
  Healthy: 'bg-green-500',
};

export default function Animals() {
  const cows = useCattleStore((s) => s.cows);
  const addCow = useCattleStore((s) => s.addCow);

  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [form, setForm] = useState({ name: '', breed: '', age: '', tagId: '' });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const filtered = cows.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.tagId.toLowerCase().includes(search.toLowerCase()) ||
      c.breed.toLowerCase().includes(search.toLowerCase()) ||
      c.id.includes(search);
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.breed || !form.age || !form.tagId) {
      setError('All fields are required.');
      return;
    }
    const tagExists = cows.find((c) => c.tagId.toLowerCase() === form.tagId.toLowerCase());
    if (tagExists) {
      setError(`Tag ID "${form.tagId}" is already registered to ${tagExists.name}.`);
      return;
    }
    addCow({ name: form.name, breed: form.breed, age: parseInt(form.age), tagId: form.tagId.toUpperCase() });
    setForm({ name: '', breed: '', age: '', tagId: '' });
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setShowForm(false);
    }, 2000);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Animals</h1>
          <p className="text-slate-500 text-sm mt-1">Manage registered cattle and ear tags</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setSubmitted(false); setError(''); }}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-colors shadow-sm"
        >
          <Plus size={16} />
          Register Cow
        </button>
      </div>

      {/* Register Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Register New Cow</h2>
              <p className="text-sm text-slate-500 mt-1">Add a new cow to the monitoring system</p>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {submitted ? (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
                  <CheckCircle size={20} className="text-green-500" />
                  <div>
                    <p className="text-green-700 font-medium text-sm">Cow registered successfully!</p>
                    <p className="text-green-600 text-xs mt-0.5">Tag assigned and monitoring active.</p>
                  </div>
                </div>
              ) : (
                <>
                  {error && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                      <AlertCircle size={16} className="text-red-500" />
                      <p className="text-red-600 text-sm">{error}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Cow Name *</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="e.g. Lakshmi"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Breed *</label>
                      <select
                        value={form.breed}
                        onChange={(e) => setForm({ ...form, breed: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="">Select breed</option>
                        <option>Gir</option>
                        <option>Holstein</option>
                        <option>Sahiwal</option>
                        <option>Jersey</option>
                        <option>Murrah</option>
                        <option>Red Sindhi</option>
                        <option>Ongole</option>
                        <option>Deoni</option>
                        <option>Tharparkar</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Age (years) *</label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={form.age}
                        onChange={(e) => setForm({ ...form, age: e.target.value })}
                        placeholder="e.g. 4"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Ear Tag ID *</label>
                      <input
                        type="text"
                        value={form.tagId}
                        onChange={(e) => setForm({ ...form, tagId: e.target.value })}
                        placeholder="e.g. KA-1029"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="flex-1 border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                    >
                      Register Cow
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, tag, breed or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
        >
          <option value="all">All Status</option>
          <option value="Healthy">Healthy</option>
          <option value="Monitor">Monitor</option>
          <option value="Heat">Heat</option>
        </select>
      </div>

      {/* Animals Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((cow) => (
          <div key={cow.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold
                  ${cow.status === 'Heat' ? 'bg-red-100 text-red-600' : cow.status === 'Monitor' ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'}`}>
                  {cow.name[0]}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{cow.name}</h3>
                  <p className="text-xs text-slate-500">Cow #{cow.id}</p>
                </div>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusColors[cow.status]}`}>
                {cow.status}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Breed</span>
                <span className="font-medium text-slate-700">{cow.breed}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Age</span>
                <span className="font-medium text-slate-700">{cow.age} years</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Ear Tag</span>
                <div className="flex items-center gap-1.5">
                  <Tag size={12} className="text-slate-400" />
                  <span className="font-mono font-semibold text-slate-700">{cow.tagId}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${statusDot[cow.status]} animate-pulse`} />
              <span className="text-xs text-slate-500">Active monitoring</span>
              <Eye size={12} className="text-slate-400 ml-auto" />
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 text-slate-400">
            <div className="text-4xl mb-3">🐄</div>
            <p className="font-medium">No animals found</p>
            <p className="text-sm mt-1">Try adjusting your search or filter</p>
          </div>
        )}
      </div>
    </div>
  );
}
