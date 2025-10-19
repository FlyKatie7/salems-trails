\console.log('✅ Salem’s Trails frontend ready');

window.updateTriviaCubeData = (payload) => {
  console.log('Trivia data received:', payload);
  // here you’ll route to your real UI later
};

window.unlockEntity = (id) => {
  // this mirrors the demo board’s storage so both stay in sync
  const set = new Set(JSON.parse(localStorage.getItem('unlockedEntities') || '[]'));
  const wasNew = !set.has(id);
  set.add(id);
  localStorage.setItem('unlockedEntities', JSON.stringify([...set]));
  console.log('Unlocked entity:', id, 'new:', wasNew);
  return wasNew;
};

window.triggerWebGrowthAnimation = (id) => {
  console.log('Triggering animation for entity:', id);
};

/** Bootstrap: load data from backend when ?entity=ID is present */
(async function bootFromQR(){
  try {
    const id = new URLSearchParams(location.search).get('entity');
    if (!id) return;

    const API = 'http://localhost:5001';
    const [entityRes, triviaRes] = await Promise.all([
      fetch(`${API}/api/entity/${id}`),
      fetch(`${API}/api/trivia/${id}`)
    ]);
    if (!entityRes.ok) throw new Error('entity not found');

    const { entity, era } = await entityRes.json();
    const questions = (await triviaRes.json())?.questions || [];
    const payload = { data: { entity, questions }, era };

    // send into your game’s existing hooks
    window.updateTriviaCubeData?.(payload);

    // set the header (title/subtitle/color) to match era
    window.setEraBanner?.(era);

    // unlock flow
    const wasNew = window.unlockEntity?.(entity.id);
    if (wasNew && window.triggerWebGrowthAnimation) {
      window.triggerWebGrowthAnimation(entity.id);
    }
  } catch (e) {
    console.error('[bootFromQR] failed:', e);
  }
})();

