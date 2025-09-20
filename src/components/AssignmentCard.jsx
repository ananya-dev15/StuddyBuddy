import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const AssignmentCard = () => {
  const [assignments, setAssignments] = useState([]);
  const [hackathons, setHackathons] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [platformProfiles, setPlatformProfiles] = useState({
    leetcode: "",
    codeforces: "",
    linkedin: "",
    devfolio: "",
    codechef: "",
  });
  const [coins, setCoins] = useState(
    () => parseInt(localStorage.getItem("coins")) || 100
  );
  const [tabSwitches, setTabSwitches] = useState(
    () => parseInt(localStorage.getItem("tabSwitches")) || 0
  );
  const [darkMode, setDarkMode] = useState(false);
  const [weeklyStats, setWeeklyStats] = useState({});
  const [filter, setFilter] = useState("All");

  const [newAssignment, setNewAssignment] = useState({
    title: "",
    deadline: "",
  });
  const [newHackathon, setNewHackathon] = useState({
    title: "",
    date: "",
    platform: "",
    link: "",
  });
  const [newReminder, setNewReminder] = useState({ title: "", time: "" });

  // Save coins & tabSwitches
  useEffect(() => {
    localStorage.setItem("coins", coins);
    localStorage.setItem("tabSwitches", tabSwitches);
  }, [coins, tabSwitches]);

  // Tab switch detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitches((prev) => {
          const newSwitches = prev + 1;
          if (newSwitches > 5) {
            if (coins >= 10) {
              setCoins((prevCoins) => prevCoins - 10);
              alert(`⚠️ Tab switched! -10 coins deducted`);
            } else {
              alert("🚫 No coins left! Stay on this tab.");
              return prev;
            }
          } else {
            alert(`⚠️ Tab switched! (${newSwitches}/5 free)`);
          }
          return newSwitches;
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [coins]);

  // Reminder notifications
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      reminders.forEach((r) => {
        const reminderTime = new Date();
        const [hours, minutes] = r.time.split(":").map(Number);
        reminderTime.setHours(hours, minutes, 0, 0);
        if (Math.abs(reminderTime - now) < 1000) {
          new Notification("Reminder: " + r.title);
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [reminders]);

  const getTimeRemaining = (deadline) => {
    const total = Date.parse(deadline) - Date.now();
    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const days = Math.floor(total / (1000 * 60 * 60 * 24));
    return { total, days, hours, minutes, seconds };
  };

  const handleAddAssignment = () => {
    if (!newAssignment.title || !newAssignment.deadline) return;
    setAssignments((prev) => [
      ...prev,
      { ...newAssignment, id: Date.now(), status: "Pending" },
    ]);
    setNewAssignment({ title: "", deadline: "" });
  };

  const handleAddHackathon = () => {
    if (!newHackathon.title || !newHackathon.date) return;
    setHackathons((prev) => [
      ...prev,
      { ...newHackathon, id: Date.now(), status: "Pending" },
    ]);
    setNewHackathon({ title: "", date: "", platform: "", link: "" });
  };

  const handleAddReminder = () => {
    if (!newReminder.title || !newReminder.time) return;
    setReminders((prev) => [...prev, { ...newReminder, id: Date.now() }]);
    setNewReminder({ title: "", time: "" });
  };

  const toggleStatus = (id, type) => {
    if (type === "assignment") {
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, status: a.status === "Pending" ? "Completed" : "Pending" }
            : a
        )
      );
    } else if (type === "hackathon") {
      setHackathons((prev) =>
        prev.map((h) =>
          h.id === id
            ? { ...h, status: h.status === "Pending" ? "Completed" : "Pending" }
            : h
        )
      );
    }
  };

  // Graph Data
  const graphData = [
    {
      name: "Assignments",
      Completed: assignments.filter((a) => a.status === "Completed").length,
      Pending: assignments.filter((a) => a.status === "Pending").length,
    },
    {
      name: "Hackathons",
      Completed: hackathons.filter((h) => h.status === "Completed").length,
      Pending: hackathons.filter((h) => h.status === "Pending").length,
    },
  ];

  // Filtered lists
  const filteredAssignments =
    filter === "All"
      ? assignments
      : assignments.filter((a) => a.status === filter);
  const filteredHackathons =
    filter === "All"
      ? hackathons
      : hackathons.filter((h) => h.status === filter);

  return (
    <div
      className={`${
        darkMode
          ? "bg-gray-900 text-white"
          : "bg-gradient-to-br from-indigo-100 via-purple-200 to-pink-100"
      } min-h-screen p-8`}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-indigo-700">
          📚 Assignment & Hackathon Tracker
        </h1>
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition"
        >
          {darkMode ? "Light Mode" : "Dark Mode"}
        </button>
      </div>

      {/* Coins Display */}
      <div className="flex gap-6 mb-6">
        <span className="bg-yellow-400 px-4 py-2 rounded-lg font-semibold shadow-md">
          🪙 {coins} Coins
        </span>
        <span className="bg-green-400 px-4 py-2 rounded-lg font-semibold shadow-md">
          🔄 {tabSwitches}/5 Free
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        {["All", "Pending", "Completed"].map((f) => (
          <button
            key={f}
            className={`px-4 py-2 rounded-lg font-semibold shadow-md ${
              filter === f
                ? "bg-indigo-600 text-white"
                : "bg-white/30 text-gray-800"
            }`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Add Assignment */}
      <div className="mb-8 p-6 bg-white/30 backdrop-blur-lg rounded-2xl shadow-md">
        <h2 className="text-xl font-semibold mb-4">📝 Add Assignment</h2>
        <input
          type="text"
          placeholder="Assignment Title"
          value={newAssignment.title}
          onChange={(e) =>
            setNewAssignment((prev) => ({ ...prev, title: e.target.value }))
          }
          className="w-full mb-2 p-2 rounded-lg border focus:ring-2 focus:ring-indigo-400"
        />
        <input
          type="datetime-local"
          value={newAssignment.deadline}
          onChange={(e) =>
            setNewAssignment((prev) => ({ ...prev, deadline: e.target.value }))
          }
          className="w-full mb-2 p-2 rounded-lg border focus:ring-2 focus:ring-indigo-400"
        />
        <button
          onClick={handleAddAssignment}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition"
        >
          Add Assignment
        </button>
      </div>

      {/* Add Hackathon */}
      <div className="mb-8 p-6 bg-white/30 backdrop-blur-lg rounded-2xl shadow-md">
        <h2 className="text-xl font-semibold mb-4">🏆 Add Hackathon</h2>
        <input
          type="text"
          placeholder="Hackathon Title"
          value={newHackathon.title}
          onChange={(e) =>
            setNewHackathon((prev) => ({ ...prev, title: e.target.value }))
          }
          className="w-full mb-2 p-2 rounded-lg border focus:ring-2 focus:ring-indigo-400"
        />
        <input
          type="date"
          value={newHackathon.date}
          onChange={(e) =>
            setNewHackathon((prev) => ({ ...prev, date: e.target.value }))
          }
          className="w-full mb-2 p-2 rounded-lg border focus:ring-2 focus:ring-indigo-400"
        />
        <input
          type="text"
          placeholder="Platform"
          value={newHackathon.platform}
          onChange={(e) =>
            setNewHackathon((prev) => ({ ...prev, platform: e.target.value }))
          }
          className="w-full mb-2 p-2 rounded-lg border focus:ring-2 focus:ring-indigo-400"
        />
        <input
          type="text"
          placeholder="Link"
          value={newHackathon.link}
          onChange={(e) =>
            setNewHackathon((prev) => ({ ...prev, link: e.target.value }))
          }
          className="w-full mb-2 p-2 rounded-lg border focus:ring-2 focus:ring-indigo-400"
        />
        <button
          onClick={handleAddHackathon}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition"
        >
          Add Hackathon
        </button>
      </div>

      {/* Add Reminder */}
      <div className="mb-8 p-6 bg-white/30 backdrop-blur-lg rounded-2xl shadow-md">
        <h2 className="text-xl font-semibold mb-4">⏰ Add Reminder</h2>
        <input
          type="text"
          placeholder="Reminder Title"
          value={newReminder.title}
          onChange={(e) =>
            setNewReminder((prev) => ({ ...prev, title: e.target.value }))
          }
          className="w-full mb-2 p-2 rounded-lg border focus:ring-2 focus:ring-indigo-400"
        />
        <input
          type="time"
          value={newReminder.time}
          onChange={(e) =>
            setNewReminder((prev) => ({ ...prev, time: e.target.value }))
          }
          className="w-full mb-2 p-2 rounded-lg border focus:ring-2 focus:ring-indigo-400"
        />
        <button
          onClick={handleAddReminder}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition"
        >
          Add Reminder
        </button>
      </div>

      {/* Graph */}
      <div className="mb-8 p-6 bg-white/30 backdrop-blur-lg rounded-2xl shadow-md">
        <h2 className="text-xl font-semibold mb-4">📊 Weekly Stats</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={graphData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="Completed" stackId="a" fill="#4ade80" />
            <Bar dataKey="Pending" stackId="a" fill="#facc15" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Display Assignments */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">📝 Assignments</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {filteredAssignments.map((a) => {
            const remaining = getTimeRemaining(a.deadline);
            let bgColor =
              a.status === "Completed"
                ? "bg-green-200"
                : remaining.total < 0
                ? "bg-red-200"
                : remaining.total < 12 * 60 * 60 * 1000
                ? "bg-orange-200"
                : "bg-yellow-200";
            return (
              <div
                key={a.id}
                className={`p-4 rounded-xl shadow-md transition transform hover:scale-105 ${bgColor}`}
              >
                <p className="font-semibold">{a.title}</p>
                <p>
                  Deadline: {new Date(a.deadline).toLocaleString()} (
                  {remaining.total > 0
                    ? `${remaining.days}d ${remaining.hours}h ${remaining.minutes}m ${remaining.seconds}s left`
                    : "Expired"}
                  )
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => toggleStatus(a.id, "assignment")}
                    className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                  >
                    {a.status === "Pending" ? "Mark Complete" : "Mark Pending"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Display Hackathons */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">🏆 Hackathons</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {filteredHackathons.map((h) => (
            <div
              key={h.id}
              className={`p-4 rounded-xl shadow-md transition transform hover:scale-105 ${
                h.status === "Completed" ? "bg-green-200" : "bg-yellow-200"
              }`}
            >
              <p className="font-semibold">{h.title}</p>
              <p>Date: {new Date(h.date).toLocaleDateString()}</p>
              <p>Platform: {h.platform}</p>
              <p>
                Link:{" "}
                <a
                  href={h.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 underline"
                >
                  {h.link}
                </a>
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => toggleStatus(h.id, "hackathon")}
                  className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                >
                  {h.status === "Pending" ? "Mark Complete" : "Mark Pending"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Display Reminders */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">⏰ Reminders</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {reminders.map((r) => (
            <div
              key={r.id}
              className="p-4 bg-white/20 backdrop-blur-lg rounded-xl shadow-md"
            >
              <p className="font-semibold">{r.title}</p>
              <p>Time: {r.time}</p>
              <p>
                Time Left:{" "}
                {(() => {
                  const now = new Date();
                  const [hours, minutes] = r.time.split(":").map(Number);
                  const target = new Date();
                  target.setHours(hours, minutes, 0, 0);
                  const diff = target - now;
                  if (diff > 0) {
                    const h = Math.floor(diff / 1000 / 60 / 60);
                    const m = Math.floor((diff / 1000 / 60) % 60);
                    const s = Math.floor((diff / 1000) % 60);
                    return `${h}h ${m}m ${s}s`;
                  } else return "Time Passed";
                })()}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AssignmentCard;
