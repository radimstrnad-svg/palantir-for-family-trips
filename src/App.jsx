import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Search,
  MapPin,
  Clock,
  Settings,
  Shield,
  Zap,
  ChevronRight,
  ChevronLeft,
  Filter,
  Users,
  Info,
  ExternalLink,
  Navigation,
  CheckSquare,
  Square,
  AlertCircle,
  Clock3,
  Map,
  Layers,
  Route,
  Activity,
  Calendar,
  DollarSign,
  Coffee,
  ChevronDown,
  ArrowRight,
  Utensils,
  Plane,
  Home,
  CheckCircle2,
  MoreVertical,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

import {
  DAYS,
  TIMELINE_SLOTS,
  itineraryItemTypes,
  itineraryItemTypeColors,
  categoryIcons,
  categoryColors,
  getInitialTripDocument,
  getSearchResults,
  projectTripDocument,
  ensureSelectionForPage,
  getEntityBySelection,
  getLocationForEntity,
  getRouteForEntity,
  getEntityById,
  makeEntityKey,
  stampFamilyMetadata,
  updateEntityInCollection,
  OBSOLETE_PLAN_ROUTE_IDS,
  OBSOLETE_PLAN_ITINERARY_IDS,
  SEEDED_PLAN_REFRESH_IDS,
  JIANG_ROAD_TRIP_STOP_DEFAULTS,
  FAMILY_VEHICLE_DEFAULTS,
  ROUTE_SIM_DEFAULTS,
  YOSEMITE_ROUTE_DEFAULTS,
  synchronizeRoutePaths,
  ENTITY_PAGE,
} from './tripModel'
import {
  formatSlotTime,
  getCurrentTripCursor,
  clampTimelineCursor,
  parseCurrencyInput,
  formatCurrency,
  cn,
} from './tripModel'
import {
  getTasksByFamily,
  getFamilyReadiness,
  getFamilyLabel,
  getExpenseAllocations,
  getFamilyExpenseBurden,
  EXPENSE_SPLIT_LABELS,
  buildManualAllocationSeed,
  getTripDayWeather,
  getMapWeather,
  getMapWeatherTargets,
} from './tripModel'
import { fetchWeatherBundle } from './weather'
import { PUBLISH_CONFIG, isLiveExternalDataEnabled } from './publishConfig'
import { clearLegacyTripStorage } from './usePersistedTripState'
import CommandMap from './CommandMap'
import InspectorRail from './InspectorRail'
import { useTripData, useUpdateFamilyStatus, useUpdateChecklist } from './integrations/supabase/hooks'
import { supabase } from './integrations/supabase/client'

const VIEW_PROFILE_STORAGE_KEY = 'trip_viewer_profile_v1'
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
const GOOGLE_MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID || ''
const SKIP_DEPRECATED_GOOGLE_PLACES_IN_DEV = false
const SKIP_DEPRECATED_GOOGLE_ROUTING_IN_DEV = false

function StatusPill({ children, tone }) {
  const styles = {
    Transit: 'bg-[#1f2937] text-[#9ca3af] border-[#374151]',
    Arrived: 'bg-[#064e3b] text-[#34d399] border-[#065f46]',
    'Family Arrival': 'bg-[#1e3a8a] text-[#93c5fd] border-[#1e40af]',
    Go: 'bg-[#064e3b] text-[#34d399] border-[#065f46]',
    Watch: 'bg-[#78350f] text-[#fbbf24] border-[#92400e]',
    Hold: 'bg-[#450a0a] text-[#f87171] border-[#7f1d1d]',
    Pending: 'bg-[#1f2937] text-[#9ca3af] border-[#374151]',
    Open: 'bg-[#78350f] text-[#fbbf24] border-[#92400e]',
    Settled: 'bg-[#064e3b] text-[#34d399] border-[#065f46]',
  }
  return (
    <div
      className={cn(
        'border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest',
        styles[tone] || styles.Pending,
      )}
    >
      {children}
    </div>
  )
}

function SectionTitle({ eyebrow, title, meta }) {
  return (
    <div className="mb-4">
      {eyebrow && <div className="text-[9px] font-black uppercase tracking-[0.25em] text-[#58A6FF]">{eyebrow}</div>}
      <div className="mt-0.5 flex items-baseline justify-between gap-4">
        <h3 className="text-[14px] font-black uppercase tracking-wider text-[#C9D1D9]">{title}</h3>
        {meta && <span className="text-[10px] lowercase italic text-[#8B949E]">{meta}</span>}
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value, muted }) {
  return (
    <div className="flex items-start gap-3">
      <div className={cn('mt-0.5', muted ? 'text-[#484f58]' : 'text-[#8B949E]')}>
        <Icon size={12} />
      </div>
      <div>
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#8B949E]">{label}</div>
        <div className={cn('mt-0.5 text-[11px] leading-relaxed', muted ? 'text-[#8B949E]' : 'text-[#C9D1D9]')}>
          {value || 'Not specified'}
        </div>
      </div>
    </div>
  )
}

function IntelAction({ icon: Icon, label, onClick, tone = 'blue' }) {
  const styles = {
    blue: 'border-[#58A6FF]/30 bg-[#58A6FF]/5 text-[#58A6FF] hover:bg-[#58A6FF]/15',
    amber: 'border-[#D29922]/30 bg-[#D29922]/5 text-[#D29922] hover:bg-[#D29922]/15',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors',
        styles[tone],
      )}
    >
      <Icon size={11} />
      <span>{label}</span>
    </button>
  )
}

function SelectableCard({ children, selected, onClick, className }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick?.()
        }
      }}
      className={cn(
        'cursor-pointer border transition-all',
        selected ? 'border-[#58A6FF] bg-[#24313d]/50' : 'border-[#30363D] bg-[#161b22] hover:border-[#484f58]',
        className,
      )}
    >
      {children}
    </div>
  )
}

function NotesBox({ value, onChange, placeholder }) {
  return (
    <textarea
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full border border-[#30363D] bg-[#0d1117] p-3 text-[11px] leading-relaxed text-[#C9D1D9] focus:border-[#58A6FF] outline-none transition-colors"
      rows={4}
    />
  )
}

function PageNotesCard({ title, value, onChange, onConvert, placeholder }) {
  return (
    <div className="border border-[#30363D] bg-[#161b22] p-5">
      <div className="mb-4 flex items-center justify-between">
        <SectionTitle eyebrow="Intel" title={title} />
        {value?.trim() ? (
          <button
            type="button"
            onClick={onConvert}
            className="flex items-center gap-2 border border-[#30363D] bg-[#0d1117] px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-[#8B949E] hover:border-[#58A6FF]/40 hover:text-[#58A6FF]"
          >
            <CheckSquare size={10} />
            Convert to task
          </button>
        ) : null}
      </div>
      <NotesBox value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  )
}

function FamilyList({ doc, selection, onSelectEntity }) {
  return (
    <div className="mt-4 space-y-2">
      {doc.families.map((family) => (
        <SelectableCard
          key={family.id}
          selected={selection.type === 'family' && selection.id === family.id}
          onClick={() => onSelectEntity('family', family.id)}
          className="flex items-center justify-between px-4 py-3"
        >
          <div className="flex flex-col">
            <span className="text-[11px] font-black uppercase tracking-widest text-[#C9D1D9]">{family.title}</span>
            <span className="text-[10px] text-[#8B949E]">{family.origin}</span>
          </div>
          <StatusPill tone={family.status}>{family.status}</StatusPill>
        </SelectableCard>
      ))}
    </div>
  )
}

function AppShell({
  children,
  doc,
  onSetSelectedPage,
  onExport,
  onSearchChange,
  searchResults,
  onOpenEntity,
  families,
  activeFamily,
  onSetActiveFamily,
}) {
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const searchInputRef = useRef(null)

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        setShowSearch(true)
      } else if (event.key === 'Escape') {
        setShowSearch(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (showSearch) {
      searchInputRef.current?.focus()
    }
  }, [showSearch])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0d1117] font-sans antialiased selection:bg-[#58A6FF]/30">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#30363D] bg-[#0d1117] px-6">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center border border-[#58A6FF] bg-[#58A6FF]/10">
              <Shield className="text-[#58A6FF]" size={18} />
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.3em] text-[#C9D1D9]">
                {doc.ui.commandName.toUpperCase()}
              </div>
              <div className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-[#8B949E]">
                Operational Surface // V1.0.4RC
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-1.5 rounded-sm border border-[#30363D] bg-[#161b22] px-1 py-1">
            {[
              { id: 'itinerary', label: 'Timeline', icon: Clock },
              { id: 'stay', label: 'Basecamp', icon: Home },
              { id: 'meals', label: 'Logistics', icon: Utensils },
              { id: 'activities', label: 'Missions', icon: Zap },
              { id: 'expenses', label: 'Ledger', icon: DollarSign },
              { id: 'families', label: 'Travel Units', icon: Users },
            ].map((page) => (
              <button
                key={page.id}
                type="button"
                onClick={() => onSetSelectedPage(page.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all',
                  doc.selectedPage === page.id
                    ? 'bg-[#58A6FF] text-[#0d1117] shadow-[0_0_12px_rgba(88,166,255,0.4)]'
                    : 'text-[#8B949E] hover:bg-[#30363D]/40 hover:text-[#C9D1D9]',
                )}
              >
                <page.icon size={13} strokeWidth={2.5} />
                <span>{page.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-3 border border-[#30363D] bg-[#161b22] px-4 py-2 text-[#8B949E] transition-colors hover:border-[#484f58] hover:text-[#C9D1D9]"
          >
            <Search size={14} />
            <span className="text-[10px] uppercase tracking-widest">Universal Search</span>
            <span className="rounded border border-[#30363D] px-1.5 py-0.5 text-[9px] font-mono">⌘K</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAccountMenu(!showAccountMenu)}
              className={cn(
                'flex items-center gap-3 border px-4 py-2 transition-all',
                activeFamily
                  ? 'border-[#3FB950]/40 bg-[#3FB950]/5 text-[#3FB950] hover:bg-[#3FB950]/12'
                  : 'border-[#30363D] bg-[#161b22] text-[#8B949E] hover:border-[#484f58]',
              )}
            >
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#C9D1D9]">
                  {activeFamily?.title || 'Assign profile'}
                </span>
                <span className="text-[8px] uppercase tracking-widest text-[#8B949E]">
                  {activeFamily ? 'Operational Profile' : 'Not assigned'}
                </span>
              </div>
              <ChevronDown size={14} />
            </button>

            <AnimatePresence>
              {showAccountMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowAccountMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="absolute right-0 top-full z-50 mt-2 w-64 border border-[#30363D] bg-[#161b22] p-1 shadow-2xl"
                  >
                    <div className="px-3 py-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[#8B949E]">
                      Select active unit
                    </div>
                    {families.map((family) => (
                      <button
                        key={family.id}
                        type="button"
                        onClick={() => {
                          onSetActiveFamily(family.id)
                          setShowAccountMenu(false)
                        }}
                        className={cn(
                          'flex w-full items-center justify-between px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#C9D1D9] transition-colors hover:bg-[#30363D]/60',
                          activeFamily?.id === family.id && 'bg-[#58A6FF]/10 text-[#58A6FF]',
                        )}
                      >
                        {family.title}
                        {activeFamily?.id === family.id && <CheckCircle2 size={12} />}
                      </button>
                    ))}
                    <div className="my-1 h-px bg-[#30363D]" />
                    <button
                      type="button"
                      onClick={() => {
                        onSetActiveFamily(null)
                        setShowAccountMenu(false)
                      }}
                      className="flex w-full items-center px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#D29922] transition-colors hover:bg-[#30363D]/60"
                    >
                      Clear active profile
                    </button>
                    <button
                      type="button"
                      onClick={onExport}
                      className="flex w-full items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#8B949E] transition-colors hover:bg-[#30363D]/60"
                    >
                      Export trip data
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {children}

      <AnimatePresence>
        {showSearch && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#0d1117]/80 backdrop-blur-md"
              onClick={() => setShowSearch(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl overflow-hidden border border-[#30363D] bg-[#161b22] shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            >
              <div className="flex items-center gap-4 border-b border-[#30363D] px-6 py-4">
                <Search size={22} className="text-[#8B949E]" />
                <input
                  ref={searchInputRef}
                  value={doc.ui.searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Seach missions, families, locations..."
                  className="flex-1 bg-transparent text-lg text-[#C9D1D9] outline-none placeholder:text-[#484f58]"
                />
                <button
                  type="button"
                  onClick={() => setShowSearch(false)}
                  className="rounded border border-[#30363D] px-2 py-1 text-[10px] font-mono text-[#8B949E]"
                >
                  ESC
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto px-2 py-2">
                {searchResults.length > 0 ? (
                  searchResults.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      type="button"
                      onClick={() => {
                        onOpenEntity(result.type, result.id)
                        setShowSearch(false)
                      }}
                      className="flex w-full items-center justify-between rounded-sm px-4 py-3 text-left transition-colors hover:bg-[#30363D]/40"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="flex h-10 w-10 items-center justify-center border border-[#30363D] bg-[#0d1117]"
                          style={{
                            color: categoryColors[result.category] || '#8B949E',
                            borderColor: `${categoryColors[result.category]}30`,
                          }}
                        >
                          {React.createElement(categoryIcons[result.category] || Info, { size: 18 })}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-[#C9D1D9]">{result.title}</div>
                          <div className="mt-0.5 text-[11px] text-[#8B949E]">{result.subtitle}</div>
                        </div>
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-[#484f58]">
                        {result.type}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-[#484f58]">
                    <Search size={40} className="mb-4 opacity-20" />
                    <div className="text-lg font-bold">No results found</div>
                    <div className="text-sm">Try searching for families, food, or upcoming missions.</div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-[#30363D] bg-[#0d1117] px-6 py-3">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-[#30363D] px-1.5 py-0.5 text-[10px] font-mono text-[#8B949E]">
                      ↵
                    </span>
                    <span className="text-[10px] text-[#8B949E]">Select</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded border border-[#30363D] px-1.5 py-0.5 text-[10px] font-mono text-[#8B949E]">
                      ↑
                    </span>
                    <span className="rounded border border-[#30363D] px-1.5 py-0.5 text-[10px] font-mono text-[#8B949E]">
                      ↓
                    </span>
                    <span className="text-[10px] text-[#8B949E]">Navigate</span>
                  </div>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-[#484f58]">
                  Universal Search Interface
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ItineraryPage({
  doc,
  selection,
  onSelectEntity,
  onSetCursor,
  onUpdateMapUi,
  onHydrateRouteDetails,
  weatherDays,
  mapWeather,
  mapWeatherTargets,
}) {
  const scrollRef = useRef(null)
  const isAutoScrollingRef = useRef(false)
  const [isTimelinePinned, setIsTimelinePinned] = useState(true)

  const handleTimelineInteraction = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const cursor = x / rect.width
    onSetCursor(cursor)
    setIsTimelinePinned(false)
  }

  useEffect(() => {
    if (!isTimelinePinned || isAutoScrollingRef.current) return
    const cursor = doc.ui.timeline.cursorSlot || 0
    if (scrollRef.current) {
      const scrollWidth = scrollRef.current.scrollWidth
      const containerWidth = scrollRef.current.offsetWidth
      const targetScroll = cursor * scrollWidth - containerWidth / 2
      scrollRef.current.scrollTo({ left: targetScroll, behavior: 'smooth' })
    }
  }, [doc.ui.timeline.cursorSlot, isTimelinePinned])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="relative h-20 shrink-0 border-b border-[#30363D] bg-[#161b22]">
        <div className="absolute inset-x-0 bottom-0 top-0 flex items-center px-6">
          <div className="relative h-8 flex-1 border border-[#30363D] bg-[#0d1117]/50" onClick={handleTimelineInteraction}>
            <div className="absolute inset-0 flex">
              {DAYS.map((day, index) => (
                <div
                  key={day.id}
                  className={cn(
                    'relative flex-1 border-r border-[#30363D]/30 px-3 py-1',
                    index === DAYS.length - 1 && 'border-r-0',
                  )}
                >
                  <div className="text-[8px] font-black uppercase tracking-widest text-[#484f58]">{day.shortLabel}</div>
                </div>
              ))}
            </div>
            <motion.div
              className="absolute inset-y-0 z-10 w-0.5 bg-[#58A6FF]"
              style={{ left: `${(doc.ui.timeline.cursorSlot || 0) * 100}%` }}
              animate={{ left: `${(doc.ui.timeline.cursorSlot || 0) * 100}%` }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              <div className="absolute -left-1.5 -top-1.5 h-3.5 w-3.5 rounded-full border-2 border-[#58A6FF] bg-[#0d1117] shadow-[0_0_8px_rgba(88,166,255,0.4)]" />
              <div className="absolute -left-[45px] top-6 rounded-sm border border-[#58A6FF]/40 bg-[#0d1117] px-2 py-1 text-[9px] font-black uppercase tracking-widest text-[#58A6FF] backdrop-blur-md">
                {formatSlotTime(doc.ui.timeline.cursorSlot)}
              </div>
            </motion.div>
          </div>
          <div className="ml-6 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsTimelinePinned(!isTimelinePinned)}
              className={cn(
                'flex items-center gap-2 border px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all',
                isTimelinePinned
                  ? 'border-[#58A6FF] bg-[#58A6FF]/10 text-[#58A6FF]'
                  : 'border-[#30363D] bg-[#0d1117] text-[#8B949E]',
              )}
            >
              <Navigation size={10} className={cn(isTimelinePinned && 'animate-pulse')} />
              <span>{isTimelinePinned ? 'Live Tracking' : 'Free Look'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_440px] overflow-hidden">
        <div className="relative overflow-hidden bg-[#0d1117]">
          <CommandMap
            doc={doc}
            selection={selection}
            onSelectEntity={onSelectEntity}
            onUpdateMapUi={onUpdateMapUi}
            onHydrateRouteDetails={onHydrateRouteDetails}
            weather={mapWeather}
            weatherTargets={mapWeatherTargets}
          />
          <div className="absolute right-6 top-6 flex flex-col gap-2">
            {[
              { id: 'all', label: 'Global fleet', icon: Layers },
              { id: 'north-star', label: 'Jiangs', icon: Users },
              { id: 'family-2', label: 'Parkers', icon: Users },
              { id: 'family-3', label: 'Riveras', icon: Users },
            ].map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => onUpdateMapUi({ focusFamilyId: view.id })}
                className={cn(
                  'flex items-center gap-3 border px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all backdrop-blur-md',
                  doc.ui.map.focusFamilyId === view.id
                    ? 'border-[#58A6FF] bg-[#58A6FF]/10 text-[#C9D1D9]'
                    : 'border-[#30363D] bg-[#161b22]/80 text-[#8B949E] hover:border-[#484f58]',
                )}
              >
                <view.icon size={13} />
                <span>{view.label}</span>
              </button>
            ))}
          </div>
          
          <div className="absolute bottom-6 left-6 flex items-center gap-2">
             <div className="flex border border-[#30363D] bg-[#161b22]/90 p-1 backdrop-blur-md">
                {DAYS.map((day) => (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => onUpdateMapUi({ focusDayId: day.id })}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all',
                      doc.ui.map.focusDayId === day.id
                        ? 'bg-[#58A6FF] text-[#0d1117]'
                        : 'text-[#8B949E] hover:bg-[#30363D]/40 hover:text-[#C9D1D9]',
                    )}
                  >
                    {day.label}
                  </button>
                ))}
             </div>
          </div>
        </div>

        <div className="flex flex-col border-l border-[#30363D] bg-[#161b22]">
          <div className="shrink-0 border-b border-[#30363D] bg-[#161b22] px-6 py-4">
            <div className="flex items-center justify-between">
              <SectionTitle eyebrow="Fleet timeline" title="Operational sequence" />
              <div className="text-[10px] lowercase italic text-[#8B949E]">{DAYS.length} days operational window</div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 scrollbar-hide">
            <div className="space-y-12">
              {DAYS.map((day) => {
                const dayItems = doc.itineraryItems.filter((item) => item.dayId === day.id)
                const dayWeather = weatherDays.find((d) => d.id === day.id)
                return (
                  <div key={day.id} className="relative">
                    <div className="sticky top-0 z-20 mb-4 flex items-center justify-between bg-[#161b22]/95 py-2 backdrop-blur-md">
                      <div className="flex items-baseline gap-3">
                        <span className="text-[18px] font-black uppercase tracking-wider text-[#C9D1D9]">
                          {day.title}
                        </span>
                        <span className="text-[11px] font-bold uppercase tracking-widest text-[#58A6FF]">
                          {day.subtitle}
                        </span>
                      </div>
                      {dayWeather && (
                        <div className="flex items-center gap-3 border border-[#30363D] bg-[#0d1117] px-3 py-1.5 text-[10px] font-bold">
                          <span className="text-[#C9D1D9]">{dayWeather.temp}°F</span>
                          <span className="text-[#8B949E] uppercase tracking-widest">{dayWeather.condition}</span>
                        </div>
                      )}
                    </div>

                    <div className="relative border-l-2 border-[#30363D] ml-2 pl-6 space-y-4">
                      {dayItems.length > 0 ? (
                        dayItems.sort((a,b) => a.startSlot - b.startSlot).map((item) => {
                          const isSelected = selection.type === 'itineraryItem' && selection.id === item.id
                          const typeConfig = itineraryItemTypes[item.category] || itineraryItemTypes.activities
                          const Icon = typeConfig.icon
                          const color = itineraryItemTypeColors[item.color] || '#8B949E'

                          return (
                            <div
                              key={item.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => onSelectEntity('itineraryItem', item.id)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault()
                                  onSelectEntity('itineraryItem', item.id)
                                }
                              }}
                              className={cn(
                                'group relative cursor-pointer border px-4 py-3 transition-all',
                                isSelected
                                  ? 'border-[#58A6FF] bg-[#24313d]/50 shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
                                  : 'border-[#30363D] bg-[#0d1117] hover:border-[#484f58]',
                              )}
                            >
                              <div
                                className="absolute -left-[31px] top-4 h-3 w-3 rounded-full border-2 bg-[#161b22]"
                                style={{ borderColor: color }}
                              />
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="flex h-8 w-8 items-center justify-center border"
                                    style={{ color, borderColor: `${color}30`, backgroundColor: `${color}05` }}
                                  >
                                    <Icon size={16} />
                                  </div>
                                  <div>
                                    <div className="text-[12px] font-black uppercase tracking-wider text-[#C9D1D9]">
                                      {item.label}
                                    </div>
                                    <div className="mt-0.5 flex items-center gap-2 text-[10px] font-bold text-[#8B949E]">
                                      <Clock size={10} />
                                      {formatSlotTime(item.startSlot)}
                                      <span className="opacity-30">·</span>
                                      {item.span * 15}m duration
                                    </div>
                                  </div>
                                </div>
                                {isSelected && (
                                  <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
                                    <ChevronRight className="text-[#58A6FF]" size={16} />
                                  </motion.div>
                                )}
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="py-2 text-[11px] italic text-[#484f58]">Operational slot unassigned</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PageEmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-[#0d1117] p-12 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center border border-[#30363D] bg-[#161b22]">
        <Icon size={40} className="text-[#484f58]" />
      </div>
      <h3 className="text-xl font-black uppercase tracking-[0.2em] text-[#C9D1D9]">{title}</h3>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-[#8B949E]">{description}</p>
    </div>
  )
}

function StayPage({ doc, selection, onSelectEntity, onUpdatePageNote, onConvertPageNote }) {
  const stayItems = doc.stayItems || []
  const activeStayId = selection.type === 'stayItem' ? selection.id : stayItems[0]?.id
  const activeStay = stayItems.find((item) => item.id === activeStayId) || null

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[360px_1fr] overflow-hidden">
      <div className="overflow-y-auto border-r border-[#30363D] bg-[#161b22] p-6">
        <SectionTitle eyebrow="Basecamp Intel" title="Lodging & Anchors" />
        <div className="space-y-2">
          {stayItems.map((item) => (
            <SelectableCard
              key={item.id}
              selected={activeStayId === item.id}
              onClick={() => onSelectEntity('stayItem', item.id)}
              className="px-4 py-3"
            >
              <div className="flex flex-col">
                <span className="text-[11px] font-black uppercase tracking-widest text-[#C9D1D9]">{item.title}</span>
                <span className="text-[10px] text-[#8B949E]">{item.category}</span>
              </div>
            </SelectableCard>
          ))}
        </div>
        <div className="mt-5">
          <PageNotesCard
            title="Basecamp note"
            value={getPageNote(doc, 'stay')}
            onChange={(value) => onUpdatePageNote('stay', value)}
            onConvert={() => onConvertPageNote('stay')}
            placeholder="Capture door codes, household rules, or shared supplies needed..."
          />
        </div>
      </div>

      <div className="overflow-y-auto bg-[#0d1117] p-6">
        {activeStay ? (
          <div className="max-w-4xl space-y-6">
            <div className="border border-[#30363D] bg-[#161b22] p-6">
              <div className="mb-4 text-[9px] font-black uppercase tracking-[0.25em] text-[#58A6FF]">
                Stay Details
              </div>
              <h2 className="text-2xl font-black uppercase tracking-wider text-[#C9D1D9]">{activeStay.title}</h2>
              <div className="mt-2 text-[11px] text-[#8B949E]">{activeStay.description}</div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="border border-[#30363D] bg-[#161b22] p-5">
                <SectionTitle eyebrow="Logistics" title="Access & Rules" />
                <div className="space-y-4">
                  <InfoRow icon={Shield} label="Check-in info" value={activeStay.checkIn} />
                  <InfoRow icon={Clock} label="Checkout protocol" value={activeStay.checkOut} />
                  <InfoRow icon={Settings} label="Rules" value={activeStay.rules || 'No specific rules listed.'} />
                </div>
              </div>
              {activeStay.locationId && (
                <div className="border border-[#30363D] bg-[#161b22] p-5">
                  <SectionTitle eyebrow="Navigation" title="Anchor Point" />
                  <IntelAction
                    icon={MapPin}
                    label="Inspect on map"
                    onClick={() => onSelectEntity('location', activeStay.locationId)}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <PageEmptyState
            icon={Home}
            title="No Stay Selected"
            description="Select a basecamp entry from the roster to view lodging logistics and check-in protocols."
          />
        )}
      </div>
    </div>
  )
}

function getPageNote(doc, pageId) {
  return doc.pageNotes?.[pageId] || ''
}

function MealsPage({ doc, selection, currentFamily, onSelectEntity, onToggleMealStatus, onUpdatePageNote, onConvertPageNote }) {
  const [editingDayName, setEditingDayName] = useState(null)
  const currentDayName = editingDayName || DAYS.find((d) => d.id === (doc.ui.timeline.cursorSlot || 0))?.title || 'Thursday'
  const dayMeals = doc.meals.filter((m) => m.dayName === currentDayName)

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[360px_1fr] overflow-hidden">
      <div className="overflow-y-auto border-r border-[#30363D] bg-[#161b22] p-6">
        <SectionTitle eyebrow="Supplies" title="Operational days" />
        <div className="space-y-1">
          {DAYS.map((day) => (
            <button
              key={day.id}
              type="button"
              onClick={() => setEditingDayName(day.title)}
              className={cn(
                'flex w-full items-center justify-between border px-4 py-3 text-left transition-all',
                currentDayName === day.title
                  ? 'border-[#58A6FF] bg-[#58A6FF]/10 text-[#C9D1D9]'
                  : 'border-transparent text-[#8B949E] hover:bg-[#30363D]/40',
              )}
            >
              <span className="text-[11px] font-black uppercase tracking-widest">{day.title}</span>
              <span className="text-[9px] font-bold text-[#484f58]">{doc.meals.filter((m) => m.dayName === day.title).length} meals</span>
            </button>
          ))}
        </div>
        <div className="mt-5">
          <PageNotesCard
            title="Logistics note"
            value={getPageNote(doc, 'meals')}
            onChange={(value) => onUpdatePageNote('meals', value)}
            onConvert={() => onConvertPageNote('meals')}
            placeholder="Capture grocery lists, allergy alerts, or specific kitchen tasks..."
          />
        </div>
      </div>

      <div className="overflow-y-auto bg-[#0d1117] p-6">
        <SectionTitle eyebrow="Fueling" title={`${currentDayName} meal plan`} />
        {currentFamily ? (
          <div className="mb-4 border border-[#30363D] bg-[#161b22] px-3 py-2 text-[11px] text-[#8B949E]">
            Toggling status as <span className="font-bold text-[#C9D1D9]">{currentFamily.title}</span>.
          </div>
        ) : null}
        <div className="grid gap-4">
          {dayMeals.map((meal) => {
            const isSelected = selection.type === 'meal' && selection.id === meal.id
            return (
              <SelectableCard
                key={meal.id}
                selected={isSelected}
                onClick={() => onSelectEntity('meal', meal.id)}
                className="p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center border border-[#30363D] bg-[#0d1117]">
                      <Utensils size={20} className="text-[#8B949E]" />
                    </div>
                    <div>
                      <div className="text-[14px] font-black uppercase tracking-wider text-[#C9D1D9]">
                        {meal.mealName}
                      </div>
                      <div className="mt-1 text-[11px] text-[#8B949E]">
                        {meal.ownerName} · {meal.note}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onToggleMealStatus(meal.id)
                    }}
                  >
                    <StatusPill tone={meal.status}>{meal.status}</StatusPill>
                  </button>
                </div>
              </SelectableCard>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function TransitStopCard({ stop, onSelectEntity }) {
  const Icon = categoryIcons[stop.category] || MapPin
  const color = categoryColors[stop.category] || '#8B949E'

  return (
    <SelectableCard onClick={() => onSelectEntity('location', stop.id)} className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex h-7 w-7 items-center justify-center border" style={{ borderColor: `${color}40`, color }}>
          <Icon size={14} />
        </div>
        <div className="text-[9px] font-black uppercase tracking-widest text-[#8B949E]">{stop.category}</div>
      </div>
      <div className="text-[11px] font-bold text-[#C9D1D9]">{stop.title}</div>
      <div className="mt-1 text-[10px] lowercase italic text-[#8B949E]">{stop.reason || 'Transit stop'}</div>
    </SelectableCard>
  )
}

function ActivityResearchCard({ eyebrow, title, bullets }) {
  return (
    <div className="border border-[#30363D] bg-[#0d1117] p-4">
      <SectionTitle eyebrow={eyebrow} title={title} />
      <ul className="space-y-2">
        {bullets.map((bullet, index) => (
          <li key={index} className="flex items-start gap-2 text-[11px] leading-relaxed text-[#8B949E]">
            <span className="mt-1.5 h-1 w-1 shrink-0 bg-[#58A6FF]" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ActivitiesPage({ doc, selection, onSelectEntity, onAddActivity, onUpdatePageNote, onConvertPageNote }) {
  const activities = doc.activities
  const [selectedTransitFamilyId, setSelectedTransitFamilyId] = useState('north-star')
  const [draftTitle, setDraftTitle] = useState('')
  const [draftDayId, setDraftDayId] = useState('thu')
  const [draftWindow, setDraftWindow] = useState('')
  const [draftDescription, setDraftDescription] = useState('')

  const selectedActivity = selection.type === 'activity' ? activities.find((a) => a.id === selection.id) : null
  const selectedLocation = selectedActivity ? getLocationForEntity(doc, selectedActivity) : null
  const research = (selectedActivity?.id === 'thu-transit' ? null : selectedActivity?.research) || null

  const transitFamilies = useMemo(() => {
    return doc.families
      .filter((family) => family.id !== 'riveras')
      .map((family) => {
        const route = doc.routes.find((r) => r.id === `route-${family.id === 'north-star' ? 'la-north-star' : 'la-family-2'}`)
        const stops = (route?.stopLocationIds || []).map((sid) => doc.locations.find((l) => l.id === sid)).filter(Boolean)
        return { family, route, stops }
      })
  }, [doc.families, doc.routes, doc.locations])

  const selectedTransitPlan = transitFamilies.find((f) => f.family.id === selectedTransitFamilyId)

  const getDayMeta = (id) => DAYS.find((d) => d.id === id)

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[360px_1fr] overflow-hidden">
      <div className="flex flex-col border-r border-[#30363D] bg-[#161b22]">
        <div className="shrink-0 p-6 pb-2">
          <SectionTitle eyebrow="Mission Ops" title="Target roster" meta={`${activities.length} total`} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2">
          {activities.map((activity) => (
            <SelectableCard
              key={activity.id}
              selected={selection.type === 'activity' && selection.id === activity.id}
              onClick={() => onSelectEntity('activity', activity.id)}
              className="mb-2 p-4"
            >
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <div className="text-[12px] font-black uppercase tracking-wider text-[#C9D1D9]">
                    {activity.title}
                  </div>
                  <div className="text-[10px] text-[#8B949E]">
                    {getDayMeta(activity.dayId)?.shortLabel.toUpperCase()} · {activity.window}
                  </div>
                </div>
                <StatusPill tone={activity.status}>{activity.status}</StatusPill>
              </div>
              <p className="mb-3 text-[11px] leading-relaxed text-[#C9D1D9]">{activity.description}</p>
              <div className="border-t border-[#30363D]/50 pt-3 text-[10px] leading-relaxed text-[#8B949E]">
                <span className="font-black uppercase tracking-widest text-[#D29922]">Fallback:</span> {activity.backup}
              </div>
            </SelectableCard>
          ))}
        </div>
        <div className="mt-5 border border-[#30363D] bg-[#0d1117] p-4">
          <SectionTitle eyebrow="Planner" title="Add activity" />
          <div className="space-y-3">
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder="Activity title"
              className="w-full border border-[#30363D] bg-[#161b22] px-3 py-2 text-[11px] text-[#C9D1D9] outline-none focus:border-[#58A6FF]"
            />
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <select
                value={draftDayId}
                onChange={(event) => setDraftDayId(event.target.value)}
                className="border border-[#30363D] bg-[#161b22] px-3 py-2 text-[11px] text-[#C9D1D9] outline-none focus:border-[#58A6FF]"
              >
                {DAYS.map((day) => (
                  <option key={day.id} value={day.id}>
                    {day.shortLabel.toUpperCase()}
                  </option>
                ))}
              </select>
              <input
                value={draftWindow}
                onChange={(event) => setDraftWindow(event.target.value)}
                placeholder="Window label"
                className="w-full border border-[#30363D] bg-[#161b22] px-3 py-2 text-[11px] text-[#C9D1D9] outline-none focus:border-[#58A6FF]"
              />
            </div>
            <NotesBox
              value={draftDescription}
              onChange={setDraftDescription}
              placeholder="Short description or planning purpose..."
            />
            <button
              type="button"
              onClick={() => {
                if (!draftTitle.trim()) return
                onAddActivity({
                  title: draftTitle.trim(),
                  dayId: draftDayId,
                  window: draftWindow.trim(),
                  description: draftDescription.trim(),
                })
                setDraftTitle('')
                setDraftDescription('')
              }}
              className="w-full border border-[#30363D] bg-[#161b22] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#C9D1D9] transition-colors hover:border-[#58A6FF]/40 hover:text-[#58A6FF]"
            >
              Add activity
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-y-auto bg-[#0d1117] p-6">
        {selectedActivity ? (
          <>
            <div className="border border-[#30363D] bg-[#161b22] p-5">
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <div className="mb-1 text-[9px] font-black uppercase tracking-[0.2em] text-[#58A6FF]">
                    Mission planning surface
                  </div>
                  <h2 className="text-[18px] font-black uppercase tracking-[0.12em] text-[#C9D1D9]">
                    {selectedActivity.title}
                  </h2>
                  <div className="mt-2 text-[11px] text-[#8B949E]">
                    {getDayMeta(selectedActivity.dayId)?.title || selectedActivity.dayId} · {selectedActivity.window}
                  </div>
                </div>
                <StatusPill tone={selectedActivity.status}>{selectedActivity.status}</StatusPill>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                {selectedLocation?.externalUrl ? (
                  <IntelAction
                    icon={MapPin}
                    label="Open location"
                    onClick={() => window.open(selectedLocation.externalUrl, '_blank', 'noreferrer')}
                  />
                ) : null}
                {selectedLocation ? (
                  <IntelAction
                    icon={Route}
                    label={`Inspect ${selectedLocation.title}`}
                    onClick={() => onSelectEntity('location', selectedLocation.id)}
                    tone="amber"
                  />
                ) : null}
              </div>

              <div className="border border-[#30363D] bg-[#0d1117] p-4">
                <SectionTitle eyebrow="Mission Frame" title="Why this day matters" />
                <div className="space-y-3">
                  <InfoRow icon={ArrowRight} label="Core plan" value={selectedActivity.description} />
                  <InfoRow icon={MapPin} label="Anchor location" value={selectedLocation?.title || 'No anchor location set'} />
                  <InfoRow icon={Search} label="Research read" value={research?.headline || selectedActivity.note || 'Build the mission details for this day.'} muted />
                  <InfoRow icon={Settings} label="Fallback" value={selectedActivity.backup} muted />
                </div>
              </div>
            </div>

            {selectedActivity.id === 'thu-transit' && selectedTransitPlan ? (
              <div className="mt-5 border border-[#30363D] bg-[#161b22] p-5">
                <SectionTitle eyebrow="Transit Planning" title="Family road trips" meta={`${transitFamilies.length} active routes`} />
                <div className="mb-4 flex flex-wrap gap-2">
                  {transitFamilies.map((entry) => (
                    <button
                      key={entry.family.id}
                      type="button"
                      onClick={() => {
                        setSelectedTransitFamilyId(entry.family.id)
                        onSelectEntity('family', entry.family.id)
                      }}
                      className={cn(
                        'border px-3 py-2 text-[10px] font-black uppercase tracking-wider',
                        selectedTransitPlan.family.id === entry.family.id
                          ? 'border-[#58A6FF] bg-[#58A6FF]/10 text-[#58A6FF]'
                          : 'border-[#30363D] bg-[#0d1117] text-[#C9D1D9]',
                      )}
                    >
                      {entry.family.title}
                    </button>
                  ))}
                </div>
                <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                  <div className="border border-[#30363D] bg-[#0d1117] p-4">
                    <SectionTitle eyebrow="Selected Family" title={selectedTransitPlan.family.title} meta={selectedTransitPlan.family.eta} />
                    <div className="space-y-3">
                      <InfoRow icon={MapPin} label="Origin" value={selectedTransitPlan.family.origin} />
                      <InfoRow icon={Route} label="Route read" value={selectedTransitPlan.family.routeSummary} muted />
                      <InfoRow icon={Users} label="Vehicle / group" value={`${selectedTransitPlan.family.vehicle} · ${selectedTransitPlan.family.headcount}`} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <IntelAction
                        icon={Users}
                        label="Inspect family"
                        onClick={() => onSelectEntity('family', selectedTransitPlan.family.id)}
                      />
                      <IntelAction
                        icon={Route}
                        label="Inspect route"
                        onClick={() => onSelectEntity('route', selectedTransitPlan.route.id)}
                        tone="amber"
                      />
                    </div>
                  </div>
                  <div className="border border-[#30363D] bg-[#0d1117] p-4">
                    <SectionTitle eyebrow="Road-trip Stops" title="Good break points" meta={`${selectedTransitPlan.stops.length} planned`} />
                    {selectedTransitPlan.stops.length ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {selectedTransitPlan.stops.map((stop) => (
                          <TransitStopCard key={stop.id} stop={stop} onSelectEntity={onSelectEntity} />
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-[#8B949E]">No stop plan attached to this route yet.</div>
                    )}
                  </div>
                </div>
              </div>
            ) : research?.cards?.length ? (
              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {research.cards.map((card) => (
                  <ActivityResearchCard
                    key={`${selectedActivity.id}-${card.title}`}
                    eyebrow={card.eyebrow}
                    title={card.title}
                    bullets={card.bullets}
                  />
                ))}
              </div>
            ) : null}

            <div className="mt-5">
              <PageNotesCard
                title="Activities note"
                value={getPageNote(doc, 'activities')}
                onChange={(value) => onUpdatePageNote('activities', value)}
                onConvert={() => onConvertPageNote('activities')}
                placeholder="Capture alternate plans, micro-itineraries, weather triggers, or new activity ideas..."
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

function ExpensesPage({
  doc,
  selection,
  currentFamily,
  onSelectEntity,
  onAddExpense,
  onToggleExpenseSettled,
  onUpdateExpenseFields,
  onSetExpenseAllocationMode,
  onUpdateExpenseAllocation,
  onResetExpenseAllocationsToEqual,
  onUpdatePageNote,
  onConvertPageNote,
}) {
  const activeExpenseId =
    selection.type === 'expense' && doc.expenses.some((expense) => expense.id === selection.id)
      ? selection.id
      : doc.expenses[0]?.id
  const activeExpense = doc.expenses.find((expense) => expense.id === activeExpenseId) || null
  const [amountDraft, setAmountDraft] = useState('')
  const [manualAllocationDrafts, setManualAllocationDrafts] = useState({})
  const [customPayerDraft, setCustomPayerDraft] = useState('')
  const total = useMemo(() => doc.expenses.reduce((sum, expense) => sum + expense.amount, 0), [doc.expenses])
  const outstanding = useMemo(
    () => doc.expenses.filter((expense) => !expense.settled).reduce((sum, expense) => sum + expense.amount, 0),
    [doc.expenses],
  )
  const familyBurden = useMemo(() => getFamilyExpenseBurden(doc.expenses, doc.families), [doc.expenses, doc.families])
  const activeAllocations = useMemo(
    () => (activeExpense ? getExpenseAllocations(activeExpense, doc.families) : []),
    [activeExpense, doc.families],
  )
  const manualAllocatedTotal = useMemo(
    () => activeAllocations.reduce((sum, allocation) => sum + allocation.amount, 0),
    [activeAllocations],
  )
  const allocationDelta = activeExpense?.allocationMode === 'manual'
    ? Number((activeExpense.amount || 0) - manualAllocatedTotal)
    : 0
  const payerOptions = useMemo(
    () => [
      ...doc.families.map((family) => family.title),
      'Each family',
      'Unassigned',
    ],
    [doc.families],
  )
  const payerMode = activeExpense && payerOptions.includes(activeExpense.payer) ? activeExpense.payer : '__custom__'

  useEffect(() => {
    if (!activeExpense) return

    setAmountDraft(activeExpense.amount === 0 ? '' : String(activeExpense.amount))
    setCustomPayerDraft(payerMode === '__custom__' ? activeExpense.payer || '' : '')
  }, [activeExpense, payerMode])

  useEffect(() => {
    if (!activeExpense || activeExpense.allocationMode !== 'manual') {
      setManualAllocationDrafts({})
      return
    }

    setManualAllocationDrafts(
      Object.fromEntries(
        getExpenseAllocations(activeExpense, doc.families).map((allocation) => [
          allocation.familyId,
          allocation.amount === 0 ? '' : String(allocation.amount),
        ]),
      ),
    )
  }, [activeExpense, doc.families])

  const commitAmountDraft = useCallback(() => {
    if (!activeExpense) return
    const parsed = parseCurrencyInput(amountDraft)
    onUpdateExpenseFields(activeExpense.id, { amount: parsed })
    setAmountDraft(parsed === 0 ? '' : String(parsed))
  }, [activeExpense, amountDraft, onUpdateExpenseFields])

  const commitManualAllocationDraft = useCallback((familyId) => {
    if (!activeExpense) return
    const parsed = parseCurrencyInput(manualAllocationDrafts[familyId] || '')
    onUpdateExpenseAllocation(activeExpense.id, familyId, parsed)
    setManualAllocationDrafts((current) => ({
      ...current,
      [familyId]: parsed === 0 ? '' : String(parsed),
    }))
  }, [activeExpense, manualAllocationDrafts, onUpdateExpenseAllocation])

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(420px,0.95fr)_minmax(440px,1.05fr)] overflow-hidden">
      <div className="overflow-y-auto border-r border-[#30363D] bg-[#161b22] p-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <SectionTitle eyebrow="Shared Costs" title="Expense ledger" meta="Editable + split-aware" />
          <button
            type="button"
            onClick={onAddExpense}
            className="border border-[#58A6FF]/40 bg-[#58A6FF]/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#C9D1D9]"
          >
            Add expense
          </button>
        </div>
        {currentFamily ? (
          <div className="mb-4 border border-[#30363D] bg-[#0d1117] px-3 py-2 text-[11px] text-[#8B949E]">
            Adding and editing as <span className="font-bold text-[#C9D1D9]">{currentFamily.title}</span>.
          </div>
        ) : null}
        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="border border-[#30363D] bg-[#0d1117] p-4">
            <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-[#8B949E]">Total tracked</div>
            <div className="text-[20px] font-black text-[#C9D1D9]">{formatCurrency(total)}</div>
          </div>
          <div className="border border-[#30363D] bg-[#0d1117] p-4">
            <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-[#8B949E]">Outstanding</div>
            <div className="text-[20px] font-black text-[#D29922]">{formatCurrency(outstanding)}</div>
          </div>
        </div>

        <div className="border border-[#30363D] bg-[#0d1117]">
          {doc.expenses.map((expense) => (
            <div
              key={expense.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectEntity('expense', expense.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelectEntity('expense', expense.id)
                }
              }}
              className={cn(
                'grid cursor-pointer grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_100px_92px] items-center gap-3 border-b border-[#30363D]/40 px-4 py-3 last:border-b-0',
                activeExpenseId === expense.id ? 'bg-[#24313d]/50' : 'hover:bg-[#1f2a34]/40',
              )}
            >
              <div className="min-w-0 text-left">
                <div className="font-bold text-[#C9D1D9]">{expense.title}</div>
                <div className="text-[10px] text-[#8B949E]">
                  {expense.payer} · {expense.split}
                </div>
                {(expense.createdByFamilyId || expense.lastEditedByFamilyId) ? (
                  <div className="mt-1 text-[9px] uppercase tracking-[0.12em] text-[#58A6FF]">
                    {expense.createdByFamilyId ? `Created by ${getFamilyLabel(doc.families, expense.createdByFamilyId)}` : ''}
                    {expense.createdByFamilyId && expense.lastEditedByFamilyId ? ' · ' : ''}
                    {expense.lastEditedByFamilyId ? `Edited by ${getFamilyLabel(doc.families, expense.lastEditedByFamilyId)}` : ''}
                  </div>
                ) : null}
              </div>
              <div className="min-w-0 text-[11px] text-[#C9D1D9]">
                {expense.allocationMode === 'individual'
                  ? 'Not shared'
                  : `${doc.families.length} families`}
              </div>
              <div className="font-mono text-[12px] text-[#C9D1D9]">{formatCurrency(expense.amount)}</div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onToggleExpenseSettled(expense.id)
                }}
                className="justify-self-end"
              >
                <StatusPill tone={expense.settled ? 'Settled' : 'Open'}>
                  {expense.settled ? 'Settled' : 'Open'}
                </StatusPill>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-y-auto bg-[#0d1117] p-6">
        {activeExpense ? (
          <>
            <SectionTitle
              eyebrow="Selected Expense"
              title={activeExpense.title}
              meta={activeExpense.settled ? 'Settled' : 'Open'}
            />
            {(activeExpense.createdByFamilyId || activeExpense.lastEditedByFamilyId) ? (
              <div className="mb-4 border border-[#30363D] bg-[#161b22] px-3 py-2 text-[11px] text-[#8B949E]">
                {activeExpense.createdByFamilyId ? (
                  <span>Created by <span className="font-bold text-[#C9D1D9]">{getFamilyLabel(doc.families, activeExpense.createdByFamilyId)}</span></span>
                ) : null}
                {activeExpense.createdByFamilyId && activeExpense.lastEditedByFamilyId ? ' · ' : null}
                {activeExpense.lastEditedByFamilyId ? (
                  <span>Last edited by <span className="font-bold text-[#C9D1D9]">{getFamilyLabel(doc.families, activeExpense.lastEditedByFamilyId)}</span></span>
                ) : null}
              </div>
            ) : null}

            <div className="mb-6 grid gap-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#8B949E]">Expense title</span>
                  <input
                    value={activeExpense.title || ''}
                    onChange={(event) => onUpdateExpenseFields(activeExpense.id, { title: event.target.value })}
                    className="border border-[#30363D] bg-[#161b22] px-3 py-2 text-[11px] text-[#C9D1D9] outline-none focus:border-[#58A6FF]"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#8B949E]">Payer</span>
                  <div className="grid gap-2">
                    <select
                      value={payerMode}
                      onChange={(event) => {
                        const value = event.target.value
                        if (value === '__custom__') {
                          onUpdateExpenseFields(activeExpense.id, { payer: customPayerDraft || activeExpense.payer || '' })
                          return
                        }
                        onUpdateExpenseFields(activeExpense.id, { payer: value })
                      }}
                      className="border border-[#30363D] bg-[#161b22] px-3 py-2 text-[11px] text-[#C9D1D9] outline-none focus:border-[#58A6FF]"
                    >
                      {payerOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                      <option value="__custom__">Custom...</option>
                    </select>
                    {payerMode === '__custom__' ? (
                      <input
                        value={customPayerDraft}
                        onChange={(event) => setCustomPayerDraft(event.target.value)}
                        onBlur={() => onUpdateExpenseFields(activeExpense.id, { payer: customPayerDraft.trim() || 'Unassigned' })}
                        placeholder="Custom payer label"
                        className="border border-[#30363D] bg-[#161b22] px-3 py-2 text-[11px] text-[#C9D1D9] outline-none focus:border-[#58A6FF]"
                      />
                    ) : null}
                  </div>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#8B949E]">Amount</span>
                  <input
                    inputMode="decimal"
                    value={amountDraft}
                    onChange={(event) => setAmountDraft(event.target.value)}
                    onBlur={commitAmountDraft}
                    onFocus={(event) => event.target.select()}
                    placeholder="0"
                    className="border border-[#30363D] bg-[#161b22] px-3 py-2 text-[11px] text-[#C9D1D9] outline-none focus:border-[#58A6FF]"
                  />
                </label>
                <div className="grid gap-1.5">
                  <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#8B949E]">Settlement</span>
                  <button
                    type="button"
                    onClick={() => onToggleExpenseSettled(activeExpense.id)}
                    className={cn(
                      'border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-left',
                      activeExpense.settled
                        ? 'border-[#3FB950]/30 bg-[#3FB950]/10 text-[#3FB950]'
                        : 'border-[#D29922]/30 bg-[#D29922]/10 text-[#D29922]',
                    )}
                  >
                    {activeExpense.settled ? 'Settled' : 'Open'}
                  </button>
                </div>
              </div>

              <div className="border border-[#30363D] bg-[#161b22] p-4">
                <SectionTitle eyebrow="Split Mode" title="Family allocation" meta={EXPENSE_SPLIT_LABELS[activeExpense.allocationMode] || activeExpense.split} />
                <div className="mb-4 flex flex-wrap gap-2">
                  {[
                    { id: 'equal', label: 'Equal split' },
                    { id: 'manual', label: 'Manual allocation' },
                    { id: 'individual', label: 'Individual' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => onSetExpenseAllocationMode(activeExpense.id, mode.id)}
                      className={cn(
                        'border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em]',
                        activeExpense.allocationMode === mode.id
                          ? 'border-[#58A6FF]/50 bg-[#58A6FF]/12 text-[#C9D1D9]'
                          : 'border-[#30363D] bg-[#0d1117] text-[#8B949E]',
                      )}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                {activeExpense.allocationMode === 'individual' ? (
                  <div className="text-[11px] leading-relaxed text-[#8B949E]">
                    This cost is marked as family-specific, so it does not contribute to shared reimbursement totals.
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {activeAllocations.map((allocation) => (
                      <div
                        key={allocation.familyId}
                        className="grid grid-cols-[minmax(0,1fr)_132px] items-center gap-3 border border-[#30363D]/60 bg-[#0d1117] px-3 py-3"
                      >
                        <div>
                          <div className="text-[11px] font-bold text-[#C9D1D9]">{allocation.title}</div>
                          <div className="text-[10px] text-[#8B949E]">
                            {activeExpense.allocationMode === 'equal' ? 'Auto-calculated share' : 'Assigned share'}
                          </div>
                        </div>
                        {activeExpense.allocationMode === 'manual' ? (
                          <input
                            inputMode="decimal"
                            value={manualAllocationDrafts[allocation.familyId] ?? ''}
                            onChange={(event) =>
                              setManualAllocationDrafts((current) => ({
                                ...current,
                                [allocation.familyId]: event.target.value,
                              }))
                            }
                            onBlur={() => commitManualAllocationDraft(allocation.familyId)}
                            onFocus={(event) => event.target.select()}
                            placeholder="0"
                            className="border border-[#30363D] bg-[#161b22] px-3 py-2 text-[11px] text-[#C9D1D9] outline-none focus:border-[#58A6FF]"
                          />
                        ) : (
                          <div className="text-right text-[12px] font-black text-[#C9D1D9]">{formatCurrency(allocation.amount)}</div>
                        )}
                      </div>
                    ))}

                    {activeExpense.allocationMode === 'manual' ? (
                      <>
                        <div className="mt-2 flex items-center justify-between border border-[#30363D]/60 bg-[#0d1117] px-3 py-3">
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8B949E]">Manual total</div>
                            <div className="text-[12px] font-bold text-[#C9D1D9]">
                              {formatCurrency(manualAllocatedTotal)} / {formatCurrency(activeExpense.amount)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onResetExpenseAllocationsToEqual(activeExpense.id)}
                            className="border border-[#30363D] bg-[#161b22] px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#C9D1D9]"
                          >
                            Reset to equal
                          </button>
                        </div>
                        {Math.abs(allocationDelta) > 0.009 ? (
                          <div className="border border-[#D29922]/30 bg-[#D29922]/10 px-3 py-2 text-[11px] text-[#D29922]">
                            {allocationDelta > 0
                              ? `${formatCurrency(allocationDelta)} still unassigned.`
                              : `${formatCurrency(Math.abs(allocationDelta))} over-assigned. Adjust the family shares.`}
                          </div>
                        ) : (
                          <div className="border border-[#3FB950]/30 bg-[#3FB950]/10 px-3 py-2 text-[11px] text-[#3FB950]">
                            Manual allocation matches the total exactly.
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                )}
              </div>

              <label className="grid gap-1.5">
                <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#8B949E]">Expense note</span>
                <textarea
                  value={activeExpense.note || ''}
                  onChange={(event) => onUpdateExpenseFields(activeExpense.id, { note: event.target.value })}
                  rows={4}
                  className="border border-[#30363D] bg-[#161b22] px-3 py-2 text-[11px] leading-relaxed text-[#C9D1D9] outline-none focus:border-[#58A6FF]"
                />
              </label>
            </div>
          </>
        ) : null}

        <div className="mb-6 border border-[#30363D] bg-[#161b22] p-4">
          <SectionTitle eyebrow="Shared Burden" title="Per-family exposure" />
          <div className="grid gap-2">
            {familyBurden.map((entry) => (
              <div
                key={entry.familyId}
                className="flex items-center justify-between border border-[#30363D]/60 bg-[#0d1117] px-3 py-2"
              >
                <div className="text-[11px] font-bold text-[#C9D1D9]">{entry.title}</div>
                <div className="text-[12px] font-black text-[#C9D1D9]">{formatCurrency(entry.amount)}</div>
              </div>
            ))}
          </div>
        </div>

        <PageNotesCard
          title="Expenses note"
          value={getPageNote(doc, 'expenses')}
          onChange={(value) => onUpdatePageNote('expenses', value)}
          onConvert={() => onConvertPageNote('expenses')}
          placeholder="Capture split assumptions, cash items, or things to settle after the trip..."
        />
      </div>
    </div>
  )
}

function FamiliesPage({ doc, selection, onSelectEntity, onUpdatePageNote, onConvertPageNote }) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[360px_1fr] overflow-hidden">
      <div className="overflow-y-auto border-r border-[#30363D] bg-[#161b22] p-6">
        <SectionTitle eyebrow="Travel Units" title="Family roster" />
        <FamilyList doc={doc} selection={selection} onSelectEntity={onSelectEntity} />
        <div className="mt-5">
          <PageNotesCard
            title="Families note"
            value={getPageNote(doc, 'families')}
            onChange={(value) => onUpdatePageNote('families', value)}
            onConvert={() => onConvertPageNote('families')}
            placeholder="Capture cross-family coordination details..."
          />
        </div>
      </div>

      <div className="overflow-y-auto bg-[#0d1117] p-6">
        <SectionTitle eyebrow="Readiness" title="Family task posture" />
        <div className="grid gap-4">
          {doc.families.map((family) => {
            const tasks = getTasksByFamily(doc, family.id)
            const readiness = getFamilyReadiness(doc, family.id)
            return (
              <SelectableCard
                key={family.id}
                selected={selection.type === 'family' && selection.id === family.id}
                onClick={() => onSelectEntity('family', family.id)}
                className="p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-[12px] font-black uppercase tracking-widest text-[#C9D1D9]">{family.title}</div>
                    <div className="text-[10px] text-[#8B949E]">{family.origin}</div>
                  </div>
                  <StatusPill tone={family.status}>{family.status}</StatusPill>
                </div>
                <div className="mb-3 h-1.5 overflow-hidden rounded-full border border-[#30363D]/30 bg-[#0d1117]">
                  <div
                    className="h-full bg-[#58A6FF] shadow-[0_0_8px_rgba(88,166,255,0.4)]"
                    style={{ width: `${readiness}%` }}
                  />
                </div>
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between text-[11px]">
                      <span className="text-[#C9D1D9]">{task.title}</span>
                      <span className={task.status === 'done' ? 'text-[#3FB950]' : 'text-[#D29922]'}>
                        {task.status}
                      </span>
                    </div>
                  ))}
                </div>
              </SelectableCard>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function withRefreshedFamilies(nextDoc) {
  return {
    ...nextDoc,
    families: nextDoc.families.map((family) => ({
      ...family,
      readiness: getFamilyReadiness(nextDoc, family.id),
    })),
  }
}

function App() {
  const { doc: supabaseDoc, isLoading: isSupabaseLoading, trip } = useTripData();
  const [doc, setDoc] = useState(getInitialTripDocument());
  const [viewerProfile, setViewerProfile] = useState({ familyId: null });

  const updateFamilyStatusMutation = useUpdateFamilyStatus();
  const updateChecklistMutation = useUpdateChecklist();

  useEffect(() => {
    if (supabaseDoc && !isSupabaseLoading) {
      // Sync doc with Supabase but merge with initial static data (locations/routes)
      setDoc(prev => ({
        ...prev,
        ...supabaseDoc,
        // Ensure static data remains if not in Supabase yet
        locations: prev.locations.length ? prev.locations : supabaseDoc.locations,
        routes: prev.routes.length ? prev.routes : supabaseDoc.routes
      }));
    }
  }, [supabaseDoc, isSupabaseLoading]);

  // Handle local persistence for viewer profile ONLY
  useEffect(() => {
    const saved = localStorage.getItem(VIEW_PROFILE_STORAGE_KEY);
    if (saved) setViewerProfile(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem(VIEW_PROFILE_STORAGE_KEY, JSON.stringify(viewerProfile));
  }, [viewerProfile]);
  const visibilityMode = PUBLISH_CONFIG.visibilityMode
  const liveExternalData = isLiveExternalDataEnabled()
  const displayDoc = useMemo(() => projectTripDocument(doc, visibilityMode), [doc, visibilityMode])
  const locationIntelHydrationRef = useRef(new Set())
  const startupTimelineSyncRef = useRef(false)
  const seededPlanRefreshRef = useRef(false)
  const [weatherState, setWeatherState] = useState({
    status: 'loading',
    targets: {},
    updatedAt: null,
    error: null,
  })

  const selection = displayDoc.selection
  const currentFamily = displayDoc.families.find((family) => family.id === viewerProfile?.familyId) || null
  const currentFamilyId = currentFamily?.id || null
  const selectedEntity = getEntityBySelection(displayDoc, selection)
  const selectedLocation = getLocationForEntity(displayDoc, selectedEntity)
  const selectedRoute = getRouteForEntity(displayDoc, selectedEntity)

  useEffect(() => {
    clearLegacyTripStorage()
  }, [])

  const setActiveFamilyProfile = useCallback((familyId) => {
    setViewerProfile({ familyId })
  }, [setViewerProfile])

  useEffect(() => {
    if (startupTimelineSyncRef.current) return
    startupTimelineSyncRef.current = true

    const nowCursor = getCurrentTripCursor()
    setDoc((current) => ({
      ...current,
      ui: {
        ...current.ui,
        timeline: {
          ...current.ui.timeline,
          cursorSlot: nowCursor,
        },
        map: {
          ...current.ui.map,
          focusFamilyId: 'all',
          focusDayId: 'all',
        },
      },
    }))
  }, [setDoc])

  useEffect(() => {
    const jiangRoute = doc.routes.find((route) => route.id === 'route-la-north-star')
    const jiangFamily = doc.families.find((family) => family.id === 'north-star')
    const yosemiteLocation = doc.locations.find((location) => location.id === 'yosemite')
    const missingStopLocations = JIANG_ROAD_TRIP_STOP_DEFAULTS.filter(
      (stop) => !doc.locations.some((location) => location.id === stop.id),
    )

    const needsRouteStops = jiangRoute && !jiangRoute.stopLocationIds?.length
    const needsFamilyStops = jiangFamily && !jiangFamily.plannedStopIds?.length
    const needsVehicleFamilyBackfill = doc.families.some((family) => {
      const defaults = FAMILY_VEHICLE_DEFAULTS[family.id]
      if (!defaults) return false
      return (
        !family.originAddress ||
        !family.originCoordinates ||
        !family.vehicleLabel ||
        (defaults.plannedStopIds?.length && !family.plannedStopIds?.length)
      )
    })
    const needsVehicleRouteBackfill = doc.routes.some((route) => {
      const defaults = ROUTE_SIM_DEFAULTS[route.id]
      if (!defaults) return false
      return (
        ('simulationStartSlot' in defaults && route.simulationStartSlot == null) ||
        ('simulationEndSlot' in defaults && route.simulationEndSlot == null) ||
        ('durationSeconds' in defaults && route.durationSeconds == null) ||
        ('originCoordinates' in defaults && !route.originCoordinates) ||
        ('destinationLocationId' in defaults && !route.destinationLocationId) ||
        ('stopLocationIds' in defaults && !Array.isArray(route.stopLocationIds))
      )
    })
    const needsYosemiteBackfill =
      yosemiteLocation &&
      (
        yosemiteLocation.title !== YOSEMITE_ROUTE_DEFAULTS.title ||
        yosemiteLocation.placesQuery !== YOSEMITE_ROUTE_DEFAULTS.placesQuery ||
        yosemiteLocation.coordinates?.lat !== YOSEMITE_ROUTE_DEFAULTS.coordinates.lat ||
        yosemiteLocation.coordinates?.lng !== YOSEMITE_ROUTE_DEFAULTS.coordinates.lng
      )

    if (
      !needsRouteStops &&
      !needsFamilyStops &&
      !missingStopLocations.length &&
      !needsVehicleFamilyBackfill &&
      !needsVehicleRouteBackfill &&
      !needsYosemiteBackfill
    ) {
      return
    }

    setDoc((current) => {
      const nextLocations = [
        ...current.locations,
        ...JIANG_ROAD_TRIP_STOP_DEFAULTS.filter(
          (stop) => !current.locations.some((location) => location.id === stop.id),
        ),
      ].map((location) =>
        location.id === 'yosemite'
          ? {
              ...location,
              ...YOSEMITE_ROUTE_DEFAULTS,
            }
          : location,
      )
      const nextFamilies = current.families.map((family) => {
        const defaults = FAMILY_VEHICLE_DEFAULTS[family.id]
        if (!defaults && family.id !== 'north-star') return family

        return {
          ...family,
          originAddress: family.originAddress || defaults?.originAddress,
          originCoordinates: family.originCoordinates || defaults?.originCoordinates,
          vehicleLabel: family.vehicleLabel || defaults?.vehicleLabel,
          plannedStopIds: family.plannedStopIds?.length ? family.plannedStopIds : defaults?.plannedStopIds || family.plannedStopIds,
          routeSummary: family.routeSummary || defaults?.routeSummary || family.routeSummary,
        }
      })

      const nextRoutes = synchronizeRoutePaths(
        current.routes.map((route) => {
          const defaults = ROUTE_SIM_DEFAULTS[route.id]
          if (!defaults) return route

          return {
            ...route,
            originCoordinates: route.originCoordinates || defaults.originCoordinates || route.path?.[0],
            path:
              route.path?.length > 1 && defaults.originCoordinates
                ? [route.originCoordinates || defaults.originCoordinates, ...route.path.slice(1)]
                : route.path,
            stopLocationIds:
              Array.isArray(route.stopLocationIds)
                ? route.stopLocationIds
                : defaults.stopLocationIds ?? route.stopLocationIds,
            destinationLocationId: route.destinationLocationId || defaults.destinationLocationId || route.destinationLocationId,
            simulationStartSlot:
              'simulationStartSlot' in defaults
                ? route.simulationStartSlot ?? defaults.simulationStartSlot
                : route.simulationStartSlot,
            simulationEndSlot:
              'simulationEndSlot' in defaults
                ? route.simulationEndSlot ?? defaults.simulationEndSlot
                : route.simulationEndSlot,
            durationSeconds:
              'durationSeconds' in defaults
                ? route.durationSeconds ?? defaults.durationSeconds
                : route.durationSeconds,
            simulationMilestones:
              'simulationMilestones' in defaults
                ? route.simulationMilestones?.length ? route.simulationMilestones : defaults.simulationMilestones
                : route.simulationMilestones,
          }
        }),
        nextLocations,
      )

      return {
        ...current,
        locations: nextLocations,
        families: nextFamilies,
        routes: nextRoutes,
      }
    })
  }, [doc.families, doc.locations, doc.routes, setDoc])

  useEffect(() => {
    if (seededPlanRefreshRef.current) return

    const initialDoc = getInitialTripDocument()
    const currentById = (collection) => new Map(collection.map((item) => [item.id, item]))
    const collectionNeedsRefresh = (currentCollection, initialCollection, refreshIds) => {
      const currentMap = currentById(currentCollection)
      const initialMap = currentById(initialCollection)
      return [...refreshIds].some((id) => {
        const currentItem = currentMap.get(id)
        const initialItem = initialMap.get(id)
        return !currentItem || !initialItem || JSON.stringify(currentItem) !== JSON.stringify(initialItem)
      })
    }
    const missingRoutes = initialDoc.routes.filter((route) => !doc.routes.some((currentRoute) => currentRoute.id === route.id))
    const missingItineraryItems = initialDoc.itineraryItems.filter(
      (item) => !doc.itineraryItems.some((currentItem) => currentItem.id === item.id),
    )
    const hasObsoleteRoutes = doc.routes.some((route) => OBSOLETE_PLAN_ROUTE_IDS.has(route.id))
    const hasObsoleteItineraryItems = doc.itineraryItems.some((item) => OBSOLETE_PLAN_ITINERARY_IDS.has(item.id))
    const needsPlanRefresh =
      collectionNeedsRefresh(doc.families, initialDoc.families, SEEDED_PLAN_REFRESH_IDS.families) ||
      collectionNeedsRefresh(doc.locations, initialDoc.locations, SEEDED_PLAN_REFRESH_IDS.locations) ||
      collectionNeedsRefresh(doc.meals, initialDoc.meals, SEEDED_PLAN_REFRESH_IDS.meals) ||
      collectionNeedsRefresh(doc.activities, initialDoc.activities, SEEDED_PLAN_REFRESH_IDS.activities) ||
      collectionNeedsRefresh(doc.tasks, initialDoc.tasks, SEEDED_PLAN_REFRESH_IDS.tasks) ||
      collectionNeedsRefresh(doc.routes, initialDoc.routes, SEEDED_PLAN_REFRESH_IDS.routes) ||
      collectionNeedsRefresh(doc.itineraryItems, initialDoc.itineraryItems, SEEDED_PLAN_REFRESH_IDS.itineraryItems)

    if (!missingRoutes.length && !missingItineraryItems.length && !hasObsoleteRoutes && !hasObsoleteItineraryItems && !needsPlanRefresh) {
      seededPlanRefreshRef.current = true
      return
    }

    seededPlanRefreshRef.current = true
    setDoc((current) => {
      const syncCollection = (currentCollection, initialCollection, refreshIds, obsoleteIds = new Set()) => {
        const initialMap = new Map(initialCollection.map((item) => [item.id, item]))
        const filtered = currentCollection.filter((item) => !obsoleteIds.has(item.id))
        const existingIds = new Set(filtered.map((item) => item.id))
        const replaced = filtered.map((item) => (refreshIds.has(item.id) && initialMap.has(item.id) ? initialMap.get(item.id) : item))
        const additions = [...refreshIds]
          .filter((id) => !existingIds.has(id) && initialMap.has(id))
          .map((id) => initialMap.get(id))
        return [...replaced, ...additions]
      }

      const nextLocations = syncCollection(
        current.locations,
        initialDoc.locations,
        SEEDED_PLAN_REFRESH_IDS.locations,
      )
      const nextRoutes = synchronizeRoutePaths(
        syncCollection(
          [
            ...current.routes,
            ...initialDoc.routes.filter((route) => !current.routes.some((currentRoute) => currentRoute.id === route.id)),
          ],
          initialDoc.routes,
          SEEDED_PLAN_REFRESH_IDS.routes,
          OBSOLETE_PLAN_ROUTE_IDS,
        ),
        nextLocations,
      )
      const nextItineraryItems = syncCollection(
        [
          ...current.itineraryItems,
          ...initialDoc.itineraryItems.filter((item) => !current.itineraryItems.some((currentItem) => currentItem.id === item.id)),
        ],
        initialDoc.itineraryItems,
        SEEDED_PLAN_REFRESH_IDS.itineraryItems,
        OBSOLETE_PLAN_ITINERARY_IDS,
      )
      const nextSelection =
        (current.selection?.type === 'route' && OBSOLETE_PLAN_ROUTE_IDS.has(current.selection.id)) ||
        (current.selection?.type === 'itineraryItem' && OBSOLETE_PLAN_ITINERARY_IDS.has(current.selection.id))
          ? initialDoc.selection
          : current.selection

      return {
        ...current,
        selection: nextSelection,
        pageNotes: {
          ...current.pageNotes,
          meals: initialDoc.pageNotes.meals,
          activities: initialDoc.pageNotes.activities,
        },
        families: syncCollection(current.families, initialDoc.families, SEEDED_PLAN_REFRESH_IDS.families),
        locations: nextLocations,
        meals: syncCollection(current.meals, initialDoc.meals, SEEDED_PLAN_REFRESH_IDS.meals),
        activities: syncCollection(current.activities, initialDoc.activities, SEEDED_PLAN_REFRESH_IDS.activities),
        tasks: syncCollection(current.tasks, initialDoc.tasks, SEEDED_PLAN_REFRESH_IDS.tasks),
        routes: nextRoutes,
        itineraryItems: nextItineraryItems,
      }
    })
  }, [doc.activities, doc.families, doc.itineraryItems, doc.locations, doc.meals, doc.routes, doc.tasks, setDoc])
  const searchResults = useMemo(
    () => getSearchResults(displayDoc, displayDoc.ui.searchQuery),
    [displayDoc],
  )
  const timelineWeatherDays = useMemo(
    () => DAYS.map((day) => ({ ...day, ...getTripDayWeather(weatherState.targets, day) })),
    [weatherState.targets],
  )
  const mapWeather = useMemo(
    () => getMapWeather(weatherState.targets, doc.ui.map.focusDayId),
    [doc.ui.map.focusDayId, weatherState.targets],
  )
  const mapWeatherTargets = useMemo(
    () => getMapWeatherTargets(weatherState.targets, doc.ui.map.focusDayId),
    [doc.ui.map.focusDayId, weatherState.targets],
  )

  const setSelectedPage = useCallback((pageId) => {
    setDoc((current) => ({
      ...current,
      selectedPage: pageId,
      selection: ensureSelectionForPage(current, pageId),
      ui: {
        ...current.ui,
        searchQuery: '',
      },
    }))
  }, [setDoc])

  const selectEntity = useCallback((type, id) => {
    setDoc((current) => {
      if (current.selection?.type === type && current.selection?.id === id && current.ui.searchQuery === '') {
        return current
      }

      return {
        ...current,
        selection: { type, id },
        ui: { ...current.ui, searchQuery: '' },
      }
    })
  }, [setDoc])

  const openEntity = useCallback((type, id) => {
    setDoc((current) => ({
      ...current,
      selection: { type, id },
      ui: { ...current.ui, searchQuery: '' },
    }))
  }, [setDoc])

  const hydrateLocationDetails = useCallback((locationId, patch) => {
    if (!locationId || !patch) return

    setDoc((current) => {
      let changed = false
      const locations = current.locations.map((location) => {
        if (location.id !== locationId) return location

        const nextLocation = {
          ...location,
          ...patch,
        }

        if (JSON.stringify(nextLocation) !== JSON.stringify(location)) {
          changed = true
        }

        return nextLocation
      })

      if (!changed) return current

      return {
        ...current,
        locations,
        routes: synchronizeRoutePaths(current.routes, locations),
      }
    })
  }, [setDoc])

  const hydrateRouteDetails = useCallback((routeId, patch) => {
    if (!routeId || !patch) return

    setDoc((current) => {
      let changed = false
      const routes = current.routes.map((route) => {
        if (route.id !== routeId) return route

        const nextRoute = {
          ...route,
          ...patch,
        }

        if (JSON.stringify(nextRoute) !== JSON.stringify(route)) {
          changed = true
        }

        return nextRoute
      })

      if (!changed) return current

      return {
        ...current,
        routes,
      }
    })
  }, [setDoc])

  const updateLocationFields = useCallback((locationId, patch) => {
    setDoc((current) => {
      const locations = current.locations.map((location) =>
        location.id === locationId ? stampFamilyMetadata({ ...location, ...patch }, currentFamilyId) : location,
      )

      return {
        ...current,
        locations,
        routes: synchronizeRoutePaths(current.routes, locations),
      }
    })
  }, [currentFamilyId, setDoc])

  useEffect(() => {
    if (!liveExternalData) return
    if (!GOOGLE_MAPS_API_KEY) return

    const basecampLocation = doc.locations.find((location) => location.id === 'pine-airbnb')
    const pendingPlaceLocations = doc.locations.filter((location) => {
      if (!location.placesQuery) return false

      const needsPlaceMatch = location.placesQuery && !location.placeId
      const needsPlaceDetails = location.placeId && !location.websiteUrl && !location.phoneNumber && !location.rating
      const needsDriveProfile =
        location.category === 'meal' &&
        location.id !== 'pine-airbnb' &&
        basecampLocation?.coordinates &&
        !location.basecampDrive

      return (needsPlaceMatch || needsPlaceDetails || needsDriveProfile) && !locationIntelHydrationRef.current.has(location.id)
    })

    if (!pendingPlaceLocations.length) return

    let cancelled = false

    async function hydrateMealIntel() {
      try {
        if (!window.__tripCommandCenterMapsConfigured) {
          setOptions({
            key: GOOGLE_MAPS_API_KEY,
            version: 'weekly',
            mapIds: GOOGLE_MAP_ID ? [GOOGLE_MAP_ID] : undefined,
          })
          window.__tripCommandCenterMapsConfigured = true
        }

        await importLibrary('maps')
        await importLibrary('places')
        const google = window.google
        if (cancelled || !google) return

        const placesContainer = document.createElement('div')
        const placesService = SKIP_DEPRECATED_GOOGLE_PLACES_IN_DEV
          ? null
          : new google.maps.places.PlacesService(placesContainer)
        const directionsService = SKIP_DEPRECATED_GOOGLE_ROUTING_IN_DEV
          ? null
          : new google.maps.DirectionsService()

        const findPlaceMatch = (location) =>
          new Promise((resolve, reject) => {
            if (!location.placesQuery || location.placeId) {
              resolve(null)
              return
            }

            if (SKIP_DEPRECATED_GOOGLE_PLACES_IN_DEV) {
              resolve(null)
              return
            }

            placesService.findPlaceFromQuery(
              {
                query: location.placesQuery,
                fields: ['name', 'formatted_address', 'geometry', 'place_id'],
              },
              (results, status) => {
                if (status !== google.maps.places.PlacesServiceStatus.OK || !results?.length) {
                  reject(new Error(`Place match failed for ${location.id}: ${status}`))
                  return
                }
                resolve(results[0])
              },
            )
          })

        const fetchPlaceDetails = (placeId) =>
          new Promise((resolve, reject) => {
            if (!placeId) {
              resolve(null)
              return
            }

            if (SKIP_DEPRECATED_GOOGLE_PLACES_IN_DEV) {
              resolve(null)
              return
            }

            placesService.getDetails(
              {
                placeId,
                fields: ['formatted_phone_number', 'website', 'rating', 'user_ratings_total', 'opening_hours', 'photos'],
              },
              (result, status) => {
                if (status !== google.maps.places.PlacesServiceStatus.OK || !result) {
                  reject(new Error(`Place details failed for ${placeId}: ${status}`))
                  return
                }
                resolve(result)
              },
            )
          })

        const fetchDriveProfile = (origin, destination) =>
          new Promise((resolve, reject) => {
            if (!origin || !destination) {
              resolve(null)
              return
            }

            if (SKIP_DEPRECATED_GOOGLE_ROUTING_IN_DEV) {
              resolve(null)
              return
            }

            directionsService.route(
              {
                origin,
                destination,
                travelMode: google.maps.TravelMode.DRIVING,
                provideRouteAlternatives: false,
              },
              (result, status) => {
                if (status !== 'OK' || !result?.routes?.length) {
                  reject(new Error(`Drive profile failed: ${status}`))
                  return
                }

                const leg = result.routes[0]?.legs?.[0]
                resolve(
                  leg
                    ? {
                        distanceText: leg.distance?.text || '',
                        distanceMeters: leg.distance?.value || 0,
                        durationText: leg.duration?.text || '',
                        durationSeconds: leg.duration?.value || 0,
                      }
                    : null,
                )
              },
            )
          })

        for (const location of pendingPlaceLocations) {
          locationIntelHydrationRef.current.add(location.id)

          try {
            const matchedPlace = await findPlaceMatch(location)
            if (cancelled) return

            const coordinates = matchedPlace?.geometry?.location
              ? {
                  lat: matchedPlace.geometry.location.lat(),
                  lng: matchedPlace.geometry.location.lng(),
                }
              : location.coordinates
            const placeId = matchedPlace?.place_id || location.placeId
            const placeDetails = placeId ? await fetchPlaceDetails(placeId) : null
            if (cancelled) return

            const livePhotos = (placeDetails?.photos || []).slice(0, 3).map((photo, index) => ({
              id: `${location.id}-live-photo-${index + 1}`,
              label: index === 0 ? 'Live venue photo' : `Venue photo ${index + 1}`,
              imageUrl: photo.getUrl({ maxWidth: 900 }),
              sourceUrl: placeId ? `https://www.google.com/maps/place/?q=place_id:${placeId}` : location.externalUrl,
            }))

            let basecampDrive = location.basecampDrive
            if (location.category === 'meal' && basecampLocation?.coordinates && !basecampDrive) {
              try {
                basecampDrive = await fetchDriveProfile(basecampLocation.coordinates, coordinates)
              } catch {
                basecampDrive = location.basecampDrive
              }
            }

            hydrateLocationDetails(location.id, {
              title: matchedPlace?.name || location.title,
              address: matchedPlace?.formatted_address || location.address,
              coordinates,
              placeId,
              externalUrl: placeId ? `https://www.google.com/maps/place/?q=place_id:${placeId}` : location.externalUrl,
              phoneNumber: placeDetails?.formatted_phone_number || location.phoneNumber,
              websiteUrl: placeDetails?.website || location.websiteUrl,
              rating: placeDetails?.rating || location.rating,
              userRatingsTotal: placeDetails?.user_ratings_total || location.userRatingsTotal,
              openingHours: placeDetails?.opening_hours?.weekday_text || location.openingHours,
              livePhotos: livePhotos.length ? livePhotos : location.livePhotos,
              basecampDrive,
            })
          } catch {
            // Keep fallback meal intel if Google data is unavailable.
          } finally {
            locationIntelHydrationRef.current.delete(location.id)
          }
        }
      } catch {
        // Keep seeded meal data if Google libraries fail to load.
      }
    }

    hydrateMealIntel()

    return () => {
      cancelled = true
    }
  }, [doc.locations, hydrateLocationDetails, liveExternalData])

  useEffect(() => {
    if (!liveExternalData) {
      setWeatherState({
        status: 'idle',
        targets: {},
        updatedAt: null,
        error: null,
      })
      return
    }

    const basecamp = doc.locations.find((location) => location.id === 'pine-airbnb')
    const yosemite = doc.locations.find((location) => location.id === 'yosemite')
    if (!basecamp?.coordinates || !yosemite?.coordinates) return

    let cancelled = false

    const loadWeather = async () => {
      try {
        const [basecampBundle, yosemiteBundle] = await Promise.all([
          fetchWeatherBundle({ label: 'Groveland Basecamp', coordinates: basecamp.coordinates }),
          fetchWeatherBundle({ label: 'Yosemite West Entrance', coordinates: yosemite.coordinates }),
        ])

        if (cancelled) return

        setWeatherState({
          status: 'ready',
          targets: {
            basecamp: basecampBundle,
            yosemite: yosemiteBundle,
          },
          updatedAt: new Date().toISOString(),
          error: null,
        })
      } catch (error) {
        if (cancelled) return
        setWeatherState((current) => ({
          ...current,
          status: 'error',
          error: error?.message || 'Weather fetch failed',
        }))
      }
    }

    loadWeather()
    const refreshId = window.setInterval(loadWeather, 10 * 60 * 1000)

    return () => {
      cancelled = true
      window.clearInterval(refreshId)
    }
  }, [doc.locations, liveExternalData])

  const updatePageNote = (pageId, value) => {
    setDoc((current) => ({
      ...current,
      pageNotes: { ...current.pageNotes, [pageId]: value },
      pageNoteMeta: {
        ...(current.pageNoteMeta || {}),
        [pageId]: currentFamilyId
          ? {
              updatedByFamilyId: currentFamilyId,
              updatedAt: new Date().toISOString(),
            }
          : current.pageNoteMeta?.[pageId],
      },
    }))
  }

  const updateEntityNote = (type, id, value) => {
    setDoc((current) => {
      const collectionName = {
        family: 'families',
        location: 'locations',
        route: 'routes',
        itineraryItem: 'itineraryItems',
        meal: 'meals',
        activity: 'activities',
        stayItem: 'stayItems',
        expense: 'expenses',
        task: 'tasks',
      }[type]
      if (!collectionName) return current
      return {
        ...current,
        [collectionName]: updateEntityInCollection(current[collectionName], id, (item) => ({
          ...stampFamilyMetadata(item, currentFamilyId),
          note: value,
        })),
      }
    })
  }

  const toggleTask = (taskId) => {
    const task = doc.tasks?.find(t => t.id === taskId);
    if (task && task.id && !task.id.startsWith('task-user-')) {
       // Only update Supabase for permanent tasks (checklists)
       // Map 'done' status for Supabase
       updateChecklistMutation.mutate({ id: taskId, done: task.status !== 'done' });
    }

    setDoc((current) => {
      const nextDoc = {
        ...current,
        tasks: current.tasks.map((task) =>
          task.id === taskId
            ? { ...task, status: task.status === 'done' ? 'open' : 'done' }
            : task,
        ),
      }
      return withRefreshedFamilies(nextDoc)
    })
  }

  const addTask = (entityType, entityId, title) => {
    setDoc((current) => {
      const entity = getEntityById(current, entityType, entityId)
      if (!entity || !title.trim()) return current
      const newTaskId = `task-user-${Date.now()}`
      const newTask = {
        id: newTaskId,
        type: 'task',
        title,
        dayId: entity.dayId || 'all',
        status: 'open',
        ownerFamilyId:
          entityType === 'family'
            ? entity.id
            : entity.familyIds?.length === 1
              ? entity.familyIds[0]
              : null,
        linkedEntityKeys: [makeEntityKey(entityType, entityId)],
        note: '',
      }
      const stampedTask = stampFamilyMetadata(newTask, currentFamilyId)

      const collectionName = {
        family: 'families',
        location: 'locations',
        route: 'routes',
        itineraryItem: 'itineraryItems',
        meal: 'meals',
        activity: 'activities',
        stayItem: 'stayItems',
        expense: 'expenses',
        task: 'tasks',
      }[entityType]

      const nextDoc = {
        ...current,
        tasks: [...current.tasks, stampedTask],
        [collectionName]:
          entityType === 'task'
            ? current[collectionName]
            : updateEntityInCollection(current[collectionName], entityId, (item) => ({
                ...item,
                taskIds: [...(item.taskIds || []), newTaskId],
              })),
      }

      return withRefreshedFamilies(nextDoc)
    })
  }

  const addActivity = ({ title, dayId, window, description }) => {
    if (!title?.trim()) return

    const fallbackWindow = `${getDayMeta(dayId)?.shortLabel?.toUpperCase() || dayId?.toUpperCase() || 'DAY'} / flexible`
    const newActivity = stampFamilyMetadata({
      id: `activity-user-${Date.now()}`,
      type: 'activity',
      title: title.trim(),
      dayId: dayId || 'fri',
      window: window?.trim() || fallbackWindow,
      status: 'Pending',
      riskLevel: 'Low',
      weatherSensitivity: 'Low',
      locationId: dayId === 'sun' ? 'pine-airbnb' : null,
      linkedEntityKeys: [],
      taskIds: [],
      description: description?.trim() || 'Custom activity stub. Define the actual plan, why it matters, and what the fallback looks like.',
      backup: 'If this becomes too ambitious, downgrade to the easiest nearby alternative.',
      note: '',
    }, currentFamilyId)

    setDoc((current) => ({
      ...current,
      activities: [...current.activities, newActivity],
      selection: { type: 'activity', id: newActivity.id },
    }))

    // Persist to Supabase if possible
    supabase.from('pft_activities').insert({
        id: newActivity.id,
        trip_id: trip?.id,
        title: newActivity.title,
        status_text: newActivity.status,
        window_time: newActivity.window,
        description: newActivity.description
    }).then(({ error }) => {
        if (error) console.error('Supabase activity sync failed:', error);
    });
  }

  const convertNoteToTask = (entityType, entityId) => {
    const entity = getEntityById(doc, entityType, entityId)
    if (!entity?.note?.trim()) return
    addTask(entityType, entityId, entity.note.trim().split('\n')[0].slice(0, 96))
  }

  const convertPageNoteToTask = (pageId) => {
    const note = getPageNote(doc, pageId)
    if (!note.trim()) return
    const pageToEntityType = {
      itinerary: 'activity',
      stay: 'stayItem',
      meals: 'meal',
      activities: 'activity',
      expenses: 'expense',
      families: 'family',
    }
    const entityType = pageToEntityType[pageId]
    const collectionName = ENTITY_PAGE[entityType] ? {
      activity: 'activities',
      stayItem: 'stayItems',
      meal: 'meals',
      expense: 'expenses',
      family: 'families',
    }[entityType] : null
    const target = collectionName ? doc[collectionName]?.[0] : null
    if (!target) return
    addTask(target.type, target.id, note.trim().split('\n')[0].slice(0, 96))
  }

  const toggleMealStatus = (mealId) => {
    setDoc((current) => ({
      ...current,
      meals: current.meals.map((meal) =>
        meal.id === mealId
          ? stampFamilyMetadata({ ...meal, status: meal.status === 'Assigned' ? 'Pending' : 'Assigned' }, currentFamilyId)
          : meal,
      ),
    }))
  }

  const toggleExpenseSettled = (expenseId) => {
    setDoc((current) => ({
      ...current,
      expenses: current.expenses.map((expense) =>
        expense.id === expenseId
          ? stampFamilyMetadata({ ...expense, settled: !expense.settled }, currentFamilyId)
          : expense,
      ),
    }))
  }

  const updateExpenseFields = (expenseId, patch) => {
    setDoc((current) => ({
      ...current,
      expenses: current.expenses.map((expense) => {
        if (expense.id !== expenseId) return expense

        const nextExpense = { ...expense, ...patch }
        if ('amount' in patch && nextExpense.allocationMode === 'equal') {
          nextExpense.allocations = {}
        }
        return stampFamilyMetadata(nextExpense, currentFamilyId)
      }),
    }))
  }

  const setExpenseAllocationMode = (expenseId, allocationMode) => {
    setDoc((current) => ({
      ...current,
      expenses: current.expenses.map((expense) => {
        if (expense.id !== expenseId) return expense

        if (allocationMode === 'manual') {
          return stampFamilyMetadata({
            ...expense,
            allocationMode,
            split: EXPENSE_SPLIT_LABELS[allocationMode],
            allocations:
              expense.allocationMode === 'manual' && expense.allocations && Object.keys(expense.allocations).length
                ? expense.allocations
                : buildManualAllocationSeed(expense.amount, current.families),
          }, currentFamilyId)
        }

        return stampFamilyMetadata({
          ...expense,
          allocationMode,
          split: EXPENSE_SPLIT_LABELS[allocationMode],
          allocations: {},
        }, currentFamilyId)
      }),
    }))
  }

  const updateExpenseAllocation = (expenseId, familyId, amount) => {
    setDoc((current) => ({
      ...current,
      expenses: current.expenses.map((expense) =>
        expense.id === expenseId
          ? stampFamilyMetadata({
              ...expense,
              allocationMode: 'manual',
              split: EXPENSE_SPLIT_LABELS.manual,
              allocations: {
                ...(expense.allocations || {}),
                [familyId]: amount,
              },
            }, currentFamilyId)
          : expense,
      ),
    }))
  }

  const resetExpenseAllocationsToEqual = (expenseId) => {
    setDoc((current) => ({
      ...current,
      expenses: current.expenses.map((expense) =>
        expense.id === expenseId
          ? stampFamilyMetadata({
              ...expense,
              allocationMode: 'manual',
              split: EXPENSE_SPLIT_LABELS.manual,
              allocations: buildManualAllocationSeed(expense.amount, current.families),
            }, currentFamilyId)
          : expense,
      ),
    }))
  }

  const addExpense = () => {
    setDoc((current) => {
      const familyLabel = getFamilyLabel(current.families, currentFamilyId)
      const newExpense = stampFamilyMetadata({
        id: `expense-user-${Date.now()}`,
        type: 'expense',
        title: 'New shared expense',
        payer: currentFamilyId ? familyLabel : 'Unassigned',
        amount: 0,
        split: EXPENSE_SPLIT_LABELS.equal,
        allocationMode: 'equal',
        allocations: {},
        settled: false,
        linkedEntityKeys: currentFamilyId ? [makeEntityKey('family', currentFamilyId)] : [],
        note: '',
      }, currentFamilyId)

      return {
        ...current,
        expenses: [...current.expenses, newExpense],
        selection: { type: 'expense', id: newExpense.id },
        selectedPage: 'expenses',
      }
    })
  }

  const updateMapUi = (patch) => {
    setDoc((current) => ({
      ...current,
      ui: {
        ...current.ui,
        map: { ...current.ui.map, ...patch },
      },
    }))
  }

  const setTimelineCursor = useCallback((cursorSlot) => {
    setDoc((current) => ({
      ...current,
      ui: {
        ...current.ui,
        timeline: { ...current.ui.timeline, cursorSlot: clampTimelineCursor(cursorSlot) },
      },
    }))
  }, [setDoc])

  const updateSearchQuery = (searchQuery) => {
    setDoc((current) => ({
      ...current,
      ui: { ...current.ui, searchQuery },
    }))
  }

  const exportState = () => {
    const blob = new Blob([JSON.stringify(displayDoc, null, 2)], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'pine-mountain-lake-command-center.json'
    anchor.click()
    window.URL.revokeObjectURL(url)
  }

  const pageProps = {
    doc: displayDoc,
    selection,
    currentFamily,
    currentFamilyId,
    onSelectEntity: selectEntity,
    onOpenEntity: openEntity,
    onUpdatePageNote: updatePageNote,
    onConvertPageNote: convertPageNoteToTask,
    onAddActivity: addActivity,
  }

  let content = null
  if (displayDoc.selectedPage === 'itinerary') {
    content = (
      <ItineraryPage
        {...pageProps}
        onSetCursor={setTimelineCursor}
        onUpdateMapUi={updateMapUi}
        onHydrateRouteDetails={hydrateRouteDetails}
        weatherDays={timelineWeatherDays}
        mapWeather={mapWeather}
        mapWeatherTargets={mapWeatherTargets}
      />
    )
  } else if (displayDoc.selectedPage === 'stay') {
    content = <StayPage {...pageProps} />
  } else if (displayDoc.selectedPage === 'meals') {
    content = <MealsPage {...pageProps} onToggleMealStatus={toggleMealStatus} />
  } else if (displayDoc.selectedPage === 'activities') {
    content = <ActivitiesPage {...pageProps} />
  } else if (displayDoc.selectedPage === 'expenses') {
    content = (
      <ExpensesPage
        {...pageProps}
        onToggleExpenseSettled={toggleExpenseSettled}
        onUpdateExpenseFields={updateExpenseFields}
        onSetExpenseAllocationMode={setExpenseAllocationMode}
        onUpdateExpenseAllocation={updateExpenseAllocation}
        onResetExpenseAllocationsToEqual={resetExpenseAllocationsToEqual}
        onAddExpense={addExpense}
      />
    )
  } else if (displayDoc.selectedPage === 'families') {
    content = <FamiliesPage {...pageProps} />
  }

  const mainWithInspector = (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_auto] overflow-hidden">
      <div className="flex min-h-0 min-w-0 overflow-hidden">{content}</div>
      <InspectorRail
        doc={displayDoc}
        pageId={displayDoc.selectedPage}
        selection={selection}
        activeFamilyId={currentFamilyId}
        onSelectEntity={selectEntity}
        onUpdateLocationFields={updateLocationFields}
        onToggleTask={toggleTask}
        onUpdateEntityNote={updateEntityNote}
        onAddTask={addTask}
        onConvertNoteToTask={convertNoteToTask}
        onToggleMealStatus={toggleMealStatus}
        onToggleExpenseSettled={toggleExpenseSettled}
      />
    </div>
  )

  return (
    <AppShell
      doc={displayDoc}
      onSetSelectedPage={setSelectedPage}
      onExport={exportState}
      onSearchChange={updateSearchQuery}
      searchResults={searchResults}
      onOpenEntity={openEntity}
      families={displayDoc.families}
      activeFamily={currentFamily}
      onSetActiveFamily={setActiveFamilyProfile}
    >
      {mainWithInspector}
    </AppShell>
  )
}

export default App
