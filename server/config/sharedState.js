let agents = {};
let activities = [];
let activeOps = {}; // { id: { name, type, source, dest, progress, totalBytes, bytesTransferred, status, error } }
let metricsHistory = {}; // { [nodeId]: [{ timestamp, cpu, memory, latency }] }
let localLogBuffer = [];

module.exports = {
    agents,
    activities,
    activeOps,
    metricsHistory,
    localLogBuffer
};
