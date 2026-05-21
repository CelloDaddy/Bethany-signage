// ESV text for the current verse pool
// When the series changes, update the pool via the CMS and add entries here
export const ESV_VERSES: Record<string, string> = {
  "Galatians 2:20":
    "I have been crucified with Christ. It is no longer I who live, but Christ who lives in me. And the life I now live in the flesh I live by faith in the Son of God, who loved me and gave himself for me.",
  "Galatians 3:26-27":
    "For in Christ Jesus you are all sons of God, through faith. For as many of you as were baptized into Christ have put on Christ.",
  "Galatians 4:4-5":
    "But when the fullness of time had come, God sent forth his Son, born of woman, born under the law, to redeem those who were under the law, so that we might receive adoption as sons.",
  "Galatians 5:1":
    "For freedom Christ has set us free; stand firm therefore, and do not submit again to a yoke of slavery.",
  "Galatians 5:22-23":
    "But the fruit of the Spirit is love, joy, peace, patience, kindness, goodness, faithfulness, gentleness, self-control; against such things there is no law.",
  "Romans 8:15-16":
    "For you did not receive the spirit of slavery to fall back into fear, but you have received the Spirit of adoption as sons, by whom we cry, "Abba! Father!" The Spirit himself bears witness with our spirit that we are children of God.",
  "Romans 5:1":
    "Therefore, since we have been justified by faith, we have peace with God through our Lord Jesus Christ.",
  "Ephesians 1:7":
    "In him we have redemption through his blood, the forgiveness of our trespasses, according to the riches of his grace.",
  "2 Corinthians 5:17":
    "Therefore, if anyone is in Christ, he is a new creation. The old has passed away; behold, the new has come.",
  "John 8:36":
    "So if the Son sets you free, you will be free indeed.",
  "Galatians 6:14":
    "But far be it from me to boast except in the cross of our Lord Jesus Christ, by which the world has been crucified to me, and I to the world.",
  "Romans 8:1":
    "There is therefore now no condemnation for those who are in Christ Jesus.",
};

export interface VerseSlide {
  ref: string;
  text: string;
}

export function getActiveVerses(
  pool: Array<{ ref: string; active: boolean }>,
  activeCount: number
): VerseSlide[] {
  const active = pool.filter((v) => v.active);
  // Rotate based on day of year so verses change daily
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const offset = dayOfYear % Math.max(active.length, 1);
  const rotated = [...active.slice(offset), ...active.slice(0, offset)];
  return rotated.slice(0, activeCount).map((v) => ({
    ref: v.ref,
    text: ESV_VERSES[v.ref] || v.ref,
  }));
}
