import React, { useState, useEffect, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const VideoTracker = () => {
  const [url, setUrl] = useState("");
  const [videoId, setVideoId] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [watchHistory, setWatchHistory] = useState([]);
  const [progress, setProgress] = useState(0);
  const [notes, setNotes] = useState("");
  const [tag, setTag] = useState("");
  const [weeklyStats, setWeeklyStats] = useState({});
  const [filterTag, setFilterTag] = useState("");
  const [darkMode, setDarkMode] = useState(true);
  const [quote, setQuote] = useState("");
  const [coins, setCoins] = useState(() => parseInt(localStorage.getItem("coins")) || 250);
  const [tabSwitches, setTabSwitches] = useState(() => parseInt(localStorage.getItem("tabSwitches")) || 0);
  const [earnedThisVideo, setEarnedThisVideo] = useState(false);
  const [showCoinAnimation, setShowCoinAnimation] = useState(false);
  const [badges, setBadges] = useState([]);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);

  const freeLimit = 5;
  const costPerSwitch = 10;
  const coinRewardPerVideo = 50;
  const timerRef = useRef(null);
  const mockDuration = 300;

  const quotes = [
    "Stay focused & conquer your goals 🚀",
    "Discipline beats motivation 🔑",
    "Every second you study adds up 📈",
    "Switch less, learn more 📚",
    "Your effort today is your success tomorrow 🌟",
  ];

  const extractVideoId = (youtubeUrl) => {
    const regex =
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = youtubeUrl.match(regex);
    return match ? match[1] : null;
  };

  const handleLoadVideo = () => {
    const id = extractVideoId(url);
    if (id) {
      setVideoId(id);
      setStartTime(new Date());
      setProgress(0);
      setEarnedThisVideo(false);
      setQuote(quotes[Math.floor(Math.random() * quotes.length)]);

      timerRef.current = setInterval(() => {
        setProgress((prev) => {
          const next = prev + 100 / mockDuration;
          if (next >= 100 && !earnedThisVideo) {
            setCoins((prevCoins) => {
              const newCoins = prevCoins + coinRewardPerVideo;
              checkBadges(newCoins);
              return newCoins;
            });
            setEarnedThisVideo(true);
            setShowCoinAnimation(true);
            setTimeout(() => setShowCoinAnimation(false), 2000);
            clearInterval(timerRef.current);
            return 100;
          }
          return next >= 100 ? 100 : next;
        });
      }, 1000);
    } else {
      alert("❌ Please enter a valid YouTube URL");
    }
  };

  const checkBadges = (totalCoins) => {
    const newBadges = [];
    if (totalCoins >= 100 && !badges.includes("💎 100 Coins Achieved")) newBadges.push("💎 100 Coins Achieved");
    if (watchHistory.length + 1 >= 3 && !badges.includes("🎖 3 Videos Watched")) newBadges.push("🎖 3 Videos Watched");
    if (newBadges.length) setBadges((prev) => [...prev, ...newBadges]);
  };

  const handleStopTracking = () => {
    if (startTime) {
      clearInterval(timerRef.current);
      const endTime = new Date();
      const duration = Math.floor((endTime - startTime) / 1000);

      const entry = {
        url,
        videoId,
        duration,
        watchedAt: new Date().toLocaleString(),
        notes,
        tag,
      };

      setWatchHistory((prev) => [...prev, entry]);

      const day = new Date().toLocaleDateString("en-US", { weekday: "short" });
      setWeeklyStats((prev) => ({
        ...prev,
        [day]: (prev[day] || 0) + duration,
      }));

      setStartTime(null);
      setNotes("");
      setTag("");
      setProgress(0);
      setVideoId(null);
      setUrl("");
      setEarnedThisVideo(false);
    }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && timerRef.current) {
        setTabSwitches((prev) => {
          const newSwitches = prev + 1;
          if (newSwitches > freeLimit) {
            if (coins >= costPerSwitch) {
              setCoins((prevCoins) => prevCoins - costPerSwitch);
              alert(`⚠️ Tab switched! -${costPerSwitch} coins deducted`);
            } else {
              alert("🚫 No coins left! Please stay on this tab.");
              return prev;
            }
          } else {
            alert(`⚠️ Tab switched! (${newSwitches}/${freeLimit} free)`);
          }
          clearInterval(timerRef.current);
          return newSwitches;
        });
      } else if (document.visibilityState === "visible" && videoId && startTime) {
        timerRef.current = setInterval(() => {
          setProgress((prev) => {
            const next = prev + 100 / mockDuration;
            if (next >= 100 && !earnedThisVideo) {
              setCoins((prevCoins) => {
                const newCoins = prevCoins + coinRewardPerVideo;
                checkBadges(newCoins);
                return newCoins;
              });
              setEarnedThisVideo(true);
              setShowCoinAnimation(true);
              setTimeout(() => setShowCoinAnimation(false), 2000);
              clearInterval(timerRef.current);
              return 100;
            }
            return next >= 100 ? 100 : next;
          });
        }, 1000);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [videoId, startTime, coins, earnedThisVideo]);

  useEffect(() => {
    localStorage.setItem("coins", coins);
    localStorage.setItem("tabSwitches", tabSwitches);
  }, [coins, tabSwitches]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuoteIndex((prev) => (prev + 1) % quotes.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const topVideos = watchHistory.reduce((acc, curr) => {
    acc[curr.url] = (acc[curr.url] || 0) + 1;
    return acc;
  }, {});
  const sortedTopVideos = Object.entries(topVideos).sort((a, b) => b[1] - a[1]);
  const popularTags = [...new Set(watchHistory.map((h) => h.tag).filter(Boolean))];

  return (
    <div className={`${darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"} min-h-screen p-10 relative overflow-hidden font-sans`}>

      {/* Particle Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {Array.from({ length: 60 }).map((_, i) => (
          <div key={i} className="absolute bg-white rounded-full opacity-20 animate-pulse" style={{
            width: `${Math.random() * 3 + 2}px`,
            height: `${Math.random() * 3 + 2}px`,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            animationDuration: `${Math.random() * 4 + 2}s`
          }}></div>
        ))}
      </div>

      {/* Header */}
      <div className="flex justify-between items-center mb-10 relative z-10">
        <h1 className="text-4xl font-extrabold text-indigo-400 glow-heading">🎥 Study Video Tracker</h1>
        <div className="flex gap-6 items-center">
          <span className="bg-yellow-400 text-gray-900 px-4 py-2 rounded-lg font-semibold shadow-md">🪙 {coins} Coins</span>
          <span className="bg-green-400 text-gray-900 px-4 py-2 rounded-lg font-semibold shadow-md">🔄 {tabSwitches}/{freeLimit} Free</span>
          <button onClick={() => setDarkMode(!darkMode)} className="px-5 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition">{darkMode ? "Light Mode" : "Dark Mode"}</button>
        </div>
      </div>

      {/* Video Input & Buttons */}
      <div className="flex gap-4 mb-8 relative z-10">
        <input type="text" placeholder="Paste YouTube URL..." value={url} onChange={(e) => setUrl(e.target.value)} className="flex-1 p-3 border rounded-lg shadow focus:ring-2 focus:ring-indigo-400 bg-gray-700 text-white placeholder-gray-300"/>
        <button onClick={handleLoadVideo} className="px-6 py-3 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition">Load Video</button>
        {videoId && <button onClick={handleStopTracking} className="px-6 py-3 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 transition">Stop</button>}

        {showCoinAnimation && (
          <div className="absolute left-1/2 transform -translate-x-1/2 -translate-y-10 text-yellow-400 font-bold text-3xl animate-bounce-glow z-20">
            +{coinRewardPerVideo} 🪙
          </div>
        )}
      </div>

      {/* Video Player */}
      {videoId && (
        <div className="mb-10 relative z-10">
          <iframe width="100%" height="450" src={`https://www.youtube.com/embed/${videoId}`} title="YouTube Video" allowFullScreen className="rounded-xl shadow-xl mb-4"></iframe>
          <div className="w-full bg-gray-700 rounded-full h-4 mb-2">
            <div className="h-4 rounded-full transition-all animate-gradient-glow" style={{ width: `${progress}%`, background: "linear-gradient(90deg, #6366F1, #A78BFA, #EC4899)" }}></div>
          </div>
          <p className="text-center italic text-lg text-indigo-300 glow-heading">💡 {quotes[currentQuoteIndex]}</p>
          <textarea placeholder="Write notes..." value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-3 mt-4 border rounded-lg shadow focus:ring-2 focus:ring-indigo-400 bg-gray-700 text-white placeholder-gray-300"/>
          <input type="text" placeholder="Add tag..." value={tag} onChange={(e) => setTag(e.target.value)} className="w-full p-3 mt-3 border rounded-lg shadow focus:ring-2 focus:ring-indigo-400 bg-gray-700 text-white placeholder-gray-300"/>
        </div>
      )}

      {/* Weekly Stats */}
      <div className="mb-10 relative z-10">
        <h2 className="text-2xl font-bold mb-4 text-indigo-300 glow-heading">📊 Weekly Study Performance</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={Object.keys(weeklyStats).map(day => ({ day, duration: weeklyStats[day] }))}>
            <CartesianGrid strokeDasharray="3 3"/>
            <XAxis dataKey="day" stroke="#f0f0f0"/>
            <YAxis stroke="#f0f0f0"/>
            <Tooltip contentStyle={{backgroundColor:'#1f2937', color:'#f0f0f0'}}/>
            <Bar dataKey="duration" fill="#6366F1" radius={[8,8,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Watch History */}
      <div className="relative z-10">
        <h2 className="text-2xl font-bold mb-4 text-indigo-300 glow-heading">📜 Watch History</h2>
        <select onChange={(e)=>setFilterTag(e.target.value)} className="mb-6 p-2 border rounded-lg shadow focus:ring-2 focus:ring-indigo-400 bg-gray-700 text-white">
          <option value="">All Tags</option>
          {[...new Set(watchHistory.map(h=>h.tag))].map((t, idx)=><option key={idx} value={t}>{t}</option>)}
        </select>
        <div className="grid gap-6 md:grid-cols-2">
          {watchHistory.filter(h=>!filterTag||h.tag===filterTag).map((entry, idx)=>(
            <div key={idx} className="p-6 border rounded-xl shadow-md bg-gray-800 text-white hover:shadow-lg transition">
              <p><strong>🎬 Video:</strong> <a href={entry.url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline">{entry.url}</a></p>
              <p><strong>📅 Watched At:</strong> {entry.watchedAt}</p>
              <p><strong>⏱ Duration:</strong> {entry.duration}s</p>
              <p><strong>📝 Notes:</strong> {entry.notes}</p>
              <p><strong>🏷 Tag:</strong> {entry.tag}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top Videos & Tags */}
      <div className="relative z-10 mt-10">
        {sortedTopVideos.length>0 && <div className="p-6 rounded-2xl shadow-2xl bg-gray-800 mb-10">
          <h2 className="text-2xl font-bold mb-4 text-indigo-300 glow-heading">🏆 Top Videos</h2>
          <ul className="list-disc pl-5 text-gray-100">
            {sortedTopVideos.slice(0,5).map(([url,count],idx)=><li key={idx}><a href={url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline">{url}</a> — watched {count} times</li>)}
          </ul>
        </div>}

        {popularTags.length>0 && <div className="p-6 rounded-2xl shadow-2xl bg-gray-800 mb-10">
          <h2 className="text-2xl font-bold mb-4 text-indigo-300 glow-heading">🏷 Popular Tags</h2>
          <div className="flex flex-wrap gap-3 text-gray-100">
            {popularTags.map((t,idx)=><span key={idx} className="px-3 py-1 rounded-full bg-indigo-700 hover:bg-indigo-600 transition">{t}</span>)}
          </div>
        </div>}
      </div>

      {/* Badges */}
      {badges.length>0 && <div className="p-6 rounded-2xl shadow-2xl bg-gray-800 mb-10 relative z-10">
        <h2 className="text-2xl font-bold mb-4 text-indigo-300 glow-heading">🏅 Badges Earned</h2>
        <div className="flex flex-wrap gap-3 text-gray-100">
          {badges.map((b,idx)=><span key={idx} className="px-3 py-1 rounded-full bg-pink-700 hover:bg-pink-600 transition">{b}</span>)}
        </div>
      </div>}

      <style>{`
        @keyframes bounce-glow {0%{transform:translateY(0);opacity:0}50%{transform:translateY(-20px);opacity:1}100%{transform:translateY(-50px);opacity:0}}
        .animate-bounce-glow {animation:bounce-glow 2s ease-out forwards;text-shadow:0 0 12px #FFD700,0 0 16px #FFD700;}
        .glow-heading {text-shadow:0 0 6px #7c3aed,0 0 12px #a78bfa;}
        @keyframes gradient-glow {0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        .animate-gradient-glow {background-size:200% 200%;animation:gradient-glow 4s ease infinite;}
      `}</style>
    </div>
  );
};

export default VideoTracker;
