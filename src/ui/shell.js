import { createAssemblyToggle } from './assemblyToggle.js'
import { createBackdrop } from './backdrop.js'
import { createChapterNav } from './chapterNav.js'
import { createContextNotice } from './contextNotice.js'
import { createDashboard } from './dashboard.js'
import { createFallback } from './fallback.js'
import { initPanelGlow } from './glow.js'
import { createInfoPanel } from './infoPanel.js'
import { createLangSwitcher } from './langSwitcher.js'
import { createLoadingScreen } from './loadingScreen.js'
import { initPresenterHelpers } from './presenter.js'
import { createQualitySwitch } from './qualitySwitch.js'
import { createRoadmap } from './roadmap.js'
import { createStoryCard } from './storyCard.js'
import { createTourButton } from './tourButton.js'

// Wires the static overlay markup in index.html to its behavior.
export function initShell() {
  const nav = document.querySelector('.chapter-nav')
  const card = document.querySelector('.story-card')
  createBackdrop(document.querySelector('.backdrop'))
  createLoadingScreen(document.querySelector('.loading'), document.querySelector('.load-status'))
  createLangSwitcher(document.querySelector('.lang-switch'))
  createQualitySwitch(document.querySelector('.quality-menu'))
  createChapterNav(nav, { swipeAreas: [nav, card] })
  createStoryCard(card)
  createAssemblyToggle(document.querySelector('.assembly-toggle'))
  createInfoPanel(document.querySelector('.info-panel'))
  createDashboard(document.querySelector('.dashboard'))
  createRoadmap(document.querySelector('.roadmap'))
  createTourButton(document.querySelector('.tour-toggle'))
  createFallback(document.querySelector('.fallback'))
  createContextNotice(document.querySelector('.context-notice'))
  initPresenterHelpers()
  initPanelGlow()
}
