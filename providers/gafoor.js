
function getStreams(tmdbId, mediaType, season, episode) {
  console.log("[Gafoor] No verified matching source found:", tmdbId);
  return Promise.resolve([]);
}

module.exports = { getStreams };
