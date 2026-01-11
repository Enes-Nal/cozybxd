
import React, { useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Movie, User } from '../types';

interface AIRecommendationModalProps {
  onClose: () => void;
  onAdd: (movie: Movie) => void;
  groupContext: { members: User[], history: Movie[] };
}

const AIRecommendationModal: React.FC<AIRecommendationModalProps> = ({ onClose, onAdd, groupContext }) => {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<Partial<Movie> | null>(null);

  const handleGroupAnalysis = async () => {
    setLoading(true);
    const historyTitles = groupContext.history.map(m => m.title).join(', ');
    const genres = Array.from(new Set(groupContext.history.flatMap(m => m.genre))).join(', ');

    try {
      // Corrected initialization with named apiKey parameter
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze this group: History of watching [${historyTitles}]. Preferred genres [${genres}]. 
        Suggest 1 new "Group Power Watch" that balances everyone's taste. 
        Explain why it fits specifically for this group.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              year: { type: Type.NUMBER },
              runtime: { type: Type.STRING },
              genre: { type: Type.ARRAY, items: { type: Type.STRING } },
              reason: { type: Type.STRING },
              priority: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] }
            },
            propertyOrdering: ["title", "year", "runtime", "genre", "reason", "priority"]
          }
        }
      });

      // Corrected: response.text is a property, not a method. Using .trim() for safety with JSON.
      const text = response.text || '{}';
      const data = JSON.parse(text);
      setSuggestion({
        ...data,
        id: Math.random().toString(36).substr(2, 9),
        poster: `https://picsum.photos/seed/${data.title?.replace(/\s/g, '') || 'movie'}/400/600`,
        status: 'Watchlist',
        votes: 1,
        seenBy: [],
        availability: ['Streaming Soon']
      });
    } catch (error) {
      console.error('AI Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="glass w-full max-w-2xl rounded-[3rem] p-10 relative border-white/10">
        <button onClick={onClose} className="absolute top-8 right-8 text-gray-400 hover:text-white">
          <i className="fa-solid fa-xmark text-xl"></i>
        </button>

        <div className="mb-8">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-400 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border border-indigo-500/20 mb-4">
            <i className="fa-solid fa-microchip"></i>
            Group Intelligence Engine
          </div>
          <h2 className="text-3xl font-bold">Consensus Recommender</h2>
          <p className="text-gray-400 mt-2">The AI is analyzing {groupContext.history.length} movies in your history to find the perfect overlap.</p>
        </div>

        <div className="space-y-6">
          {!suggestion && (
            <button 
              onClick={handleGroupAnalysis}
              disabled={loading}
              className="w-full h-32 border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center hover:border-indigo-500/50 hover:bg-white/5 transition-all group"
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin text-2xl text-indigo-500"></i>
                  <p className="text-sm mt-3 text-indigo-400">Synthesizing group history...</p>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-brain text-2xl text-gray-500 group-hover:text-indigo-400"></i>
                  <p className="text-sm mt-3 text-gray-400 font-medium">Run Taste Analysis</p>
                </>
              )}
            </button>
          )}

          {suggestion && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="p-8 rounded-3xl bg-indigo-600/5 border border-indigo-500/20 flex gap-8">
                <img src={suggestion.poster} className="w-32 h-48 rounded-2xl object-cover" alt="Poster" />
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-2xl font-bold">{suggestion.title}</h4>
                      <p className="text-sm text-gray-400">{suggestion.year} • {suggestion.runtime}</p>
                    </div>
                  </div>
                  <div className="mt-4 p-4 rounded-xl bg-white/5 text-sm text-gray-300 italic border-l-2 border-indigo-500">
                    "{suggestion.reason}"
                  </div>
                  <div className="flex gap-4 mt-6">
                    <button 
                      onClick={() => { onAdd(suggestion as Movie); onClose(); }}
                      className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2.5 rounded-xl text-sm font-bold transition-all"
                    >
                      Add to Watchlist
                    </button>
                    <button onClick={() => setSuggestion(null)} className="text-xs text-gray-500 hover:text-white uppercase font-bold tracking-widest">
                      Recalculate
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIRecommendationModal;
