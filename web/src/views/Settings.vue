<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch, watchEffect } from 'vue'
import api from '@/api'
import ConfirmModal from '@/components/ConfirmModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import { useAccountStore } from '@/stores/account'
import { useFarmStore } from '@/stores/farm'
import { useSettingStore } from '@/stores/setting'
import { useToastStore } from '@/stores/toast'

const settingStore = useSettingStore()
const accountStore = useAccountStore()
const farmStore = useFarmStore()
const toast = useToastStore()

const { settings, loading } = storeToRefs(settingStore)
const { currentAccountId, accounts } = storeToRefs(accountStore)
const { seeds } = storeToRefs(farmStore)

const saving = ref(false)
const passwordSaving = ref(false)
const offlineSaving = ref(false)
const offlineTesting = ref(false)
const qrSaving = ref(false)
const runtimeClientSaving = ref(false)

// 瀵嗙爜璁よ瘉鐩稿叧鐘舵€?const passwordAuthDisabled = ref(false)
const passwordAuthLoading = ref(false)

const token = computed(() => {
  return localStorage.getItem('admin_token') || '鏈櫥褰?
})

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    toast.success('澶嶅埗鎴愬姛')
  }).catch(() => {
    toast.error('澶嶅埗澶辫触锛岃鎵嬪姩澶嶅埗')
  })
}

const modalVisible = ref(false)
const modalConfig = ref({
  title: '',
  message: '',
  type: 'primary' as 'primary' | 'danger',
  isAlert: true,
})

function showAlert(message: string, type: 'primary' | 'danger' = 'primary') {
  modalConfig.value = {
    title: type === 'danger' ? '閿欒' : '鎻愮ず',
    message,
    type,
    isAlert: true,
  }
  modalVisible.value = true
}

const currentAccountName = computed(() => {
  const acc = accounts.value.find((a: any) => a.id === currentAccountId.value)
  return acc ? (acc.name || acc.nick || acc.id) : null
})
const allFertilizerLandTypes = ['gold', 'black', 'red', 'normal']

const fertilizerBuyTypeOptions = [
  { label: '浠呮湁鏈哄寲鑲?, value: 'organic' },
  { label: '浠呮櫘閫氬寲鑲?, value: 'normal' },
  { label: '涓よ€呴兘涔?, value: 'both' },
]

const fertilizerBuyModeOptions = [
  { label: '瀹瑰櫒涓嶈冻鏃惰喘涔?, value: 'threshold' },
  { label: '鏃犻檺璐拱', value: 'unlimited' },
]

const fertilizerLandTypeOptions = [
  { label: '閲戝湡鍦?, value: 'gold' },
  { label: '榛戝湡鍦?, value: 'black' },
  { label: '绾㈠湡鍦?, value: 'red' },
  { label: '鏅€氬湡鍦?, value: 'normal' },
]

function normalizeFertilizerLandTypes(input: unknown) {
  const source = Array.isArray(input) ? input : allFertilizerLandTypes
  const normalized: string[] = []
  for (const item of source) {
    const value = String(item || '').trim().toLowerCase()
    if (!allFertilizerLandTypes.includes(value))
      continue
    if (normalized.includes(value))
      continue
    normalized.push(value)
  }
  return normalized
}

function normalizeStealPlantBlacklist(input: unknown) {
  const source = Array.isArray(input) ? input : []
  const normalized: number[] = []
  for (const item of source) {
    const value = Number.parseInt(String(item), 10)
    if (!Number.isFinite(value) || value <= 0)
      continue
    if (normalized.includes(value))
      continue
    normalized.push(value)
  }
  return normalized
}

const localSettings = ref({
  plantingStrategy: 'preferred',
  preferredSeedId: 0,
  bagSeedPriority: [] as number[],
  intervals: { farmMin: 2, farmMax: 2, friendMin: 10, friendMax: 10 },
  friendQuietHours: { enabled: false, start: '23:00', end: '07:00' },
  automation: {
    farm: false,
    farm_manage: false,
    farm_water: false,
    farm_weed: false,
    farm_bug: false,
    task: false,
    sell: false,
    friend: false,
    farm_push: false,
    land_upgrade: false,
    friend_steal: false,
    friend_steal_blacklist: [] as number[],
    friend_help: false,
    friend_bad: false,
    friend_help_exp_limit: false,
    email: false,
    fertilizer_gift: false,
    fertilizer_buy: false,
    fertilizer_buy_type: 'organic' as string,
    fertilizer_buy_max: 10,
    fertilizer_buy_mode: 'threshold' as string,
    fertilizer_buy_threshold: 100,
    free_gifts: false,
    share_reward: false,
    vip_gift: false,
    month_card: false,
    open_server_gift: false,
    fertilizer: 'none',
    fertilizer_multi_season: false,
    fertilizer_land_types: [...allFertilizerLandTypes],
  },
})

const friendDisabled = computed(() => !localSettings.value.automation.friend)
const farmDisabled = computed(() => !localSettings.value.automation.farm_manage)

interface StealCropOption {
  plantId: number
  seedId: number | null
  name: string
  level: number | null
  image: string
}

interface AnalyticsCropMeta {
  plantId: number
  seedId: number | null
  name: string
  level: number | null
  image: string
}

const analyticsCropMetas = ref<AnalyticsCropMeta[]>([])
const stealBlacklistSearch = ref('')
const stealBlacklistCollapsed = ref(true)
const onlyShowUnselectedStealCrops = ref(false)

watch(() => localSettings.value.automation.fertilizer_buy_mode, (mode) => {
  if (mode === 'unlimited' && localSettings.value.automation.fertilizer_buy_type === 'both')
    localSettings.value.automation.fertilizer_buy_type = 'organic'
})

watch(() => localSettings.value.automation.fertilizer_buy_type, (type) => {
  if (type === 'both' && localSettings.value.automation.fertilizer_buy_mode === 'unlimited')
    localSettings.value.automation.fertilizer_buy_mode = 'threshold'
})

function parsePositiveInt(input: unknown): number | null {
  const value = Number.parseInt(String(input ?? ''), 10)
  if (!Number.isFinite(value) || value <= 0)
    return null
  return value
}

function resolveStealCropLevel(seed: any): number | null {
  const candidates = [
    seed?.requiredLevel,
    seed?.landLevelNeed,
    seed?.land_level_need,
    seed?.unlockLevel,
    seed?.levelNeed,
  ]

  for (const candidate of candidates) {
    const value = Number(candidate)
    if (Number.isFinite(value) && value > 0)
      return value
  }

  return null
}

function resolveStealCropImage(seed: any): string {
  const candidates = [
    seed?.image,
    seed?.seedImage,
    seed?.itemImage,
    seed?.icon,
    seed?.iconUrl,
  ]

  for (const candidate of candidates) {
    const value = String(candidate || '').trim()
    if (value)
      return value
  }

  return ''
}

function normalizeAnalyticsCropLevel(input: unknown): number | null {
  const value = Number(input)
  if (!Number.isFinite(value) || value <= 0)
    return null
  return value
}

async function loadStealBlacklistAnalytics() {
  try {
    const res = await api.get('/api/analytics', {
      params: { sort: 'level' },
    })
    const data = res?.data?.ok ? (res.data.data || []) : []
    if (!Array.isArray(data)) {
      analyticsCropMetas.value = []
      return
    }

    const parsed: AnalyticsCropMeta[] = []
    for (const item of data) {
      const plantId = parsePositiveInt(item?.id ?? item?.plantId)
      if (plantId === null)
        continue
      parsed.push({
        plantId,
        seedId: parsePositiveInt(item?.seedId),
        name: String(item?.name || ''),
        level: normalizeAnalyticsCropLevel(item?.level),
        image: String(item?.image || '').trim(),
      })
    }
    analyticsCropMetas.value = parsed
  }
  catch {
    analyticsCropMetas.value = []
  }
}

const analyticsCropMetaByPlantId = computed(() => {
  const byPlantId = new Map<number, AnalyticsCropMeta>()
  for (const item of analyticsCropMetas.value) {
    const current = byPlantId.get(item.plantId)
    if (!current) {
      byPlantId.set(item.plantId, { ...item })
      continue
    }
    if (current.seedId === null && item.seedId !== null)
      current.seedId = item.seedId
    if (current.level === null && item.level !== null)
      current.level = item.level
    if (!current.image && item.image)
      current.image = item.image
    if (!current.name && item.name)
      current.name = item.name
  }
  return byPlantId
})

const stealCropOptions = computed<StealCropOption[]>(() => {
  const source = Array.isArray(seeds.value) ? seeds.value : []
  const byPlantId = new Map<number, StealCropOption>()
  const isPlaceholderName = (name: string, plantId: number) => {
    const normalized = String(name || '').trim()
    return !normalized || normalized === `浣滅墿#${plantId}` || normalized === `娴ｆ粎澧?${plantId}`
  }

  // 鍏堢敤鍒嗘瀽鏁版嵁浣滀负鍏ㄩ噺鍩哄噯锛岄伩鍏嶇櫥褰曞悗鍙樉绀哄晢搴楄繑鍥炵殑瀛愰泦
  for (const meta of analyticsCropMetas.value) {
    const plantId = parsePositiveInt(meta?.plantId)
    if (plantId === null)
      continue

    byPlantId.set(plantId, {
      plantId,
      seedId: parsePositiveInt(meta?.seedId),
      name: String(meta?.name || `浣滅墿#${plantId}`),
      level: normalizeAnalyticsCropLevel(meta?.level),
      image: String(meta?.image || '').trim(),
    })
  }

  for (const seed of source) {
    const plantId = parsePositiveInt(seed?.plantId)
    if (plantId === null)
      continue

    const analyticsMeta = analyticsCropMetaByPlantId.value.get(plantId)
    const seedIdFromSeed = parsePositiveInt(seed?.seedId ?? seed?.seed_id ?? seed?.itemId)
    const next: StealCropOption = {
      plantId,
      seedId: seedIdFromSeed ?? analyticsMeta?.seedId ?? null,
      name: String(seed?.name || analyticsMeta?.name || `浣滅墿#${plantId}`),
      level: analyticsMeta?.level ?? resolveStealCropLevel(seed),
      image: resolveStealCropImage(seed) || String(analyticsMeta?.image || '').trim(),
    }

    const current = byPlantId.get(plantId)
    if (!current) {
      byPlantId.set(plantId, next)
      continue
    }

    if (current.seedId === null && next.seedId !== null)
      current.seedId = next.seedId
    if (!current.image && next.image)
      current.image = next.image
    if (current.level === null && next.level !== null)
      current.level = next.level
    if (isPlaceholderName(current.name, current.plantId) && next.name)
      current.name = next.name
  }

  return Array.from(byPlantId.values()).sort((a, b) => {
    const aLevel = a.level === null ? Number.POSITIVE_INFINITY : a.level
    const bLevel = b.level === null ? Number.POSITIVE_INFINITY : b.level
    if (aLevel !== bLevel)
      return aLevel - bLevel

    const aSeedId = a.seedId === null ? Number.POSITIVE_INFINITY : a.seedId
    const bSeedId = b.seedId === null ? Number.POSITIVE_INFINITY : b.seedId
    if (aSeedId !== bSeedId)
      return aSeedId - bSeedId

    return a.plantId - b.plantId
  })
})
const stealBlacklistCount = computed(() => normalizeStealPlantBlacklist(localSettings.value.automation.friend_steal_blacklist).length)
const stealBlacklistSet = computed(() => new Set(normalizeStealPlantBlacklist(localSettings.value.automation.friend_steal_blacklist)))

function isCropBlacklisted(plantId: number) {
  return stealBlacklistSet.value.has(plantId)
}

function toggleStealBlacklistCrop(plantId: number) {
  const current = normalizeStealPlantBlacklist(localSettings.value.automation.friend_steal_blacklist)
  if (current.includes(plantId)) {
    localSettings.value.automation.friend_steal_blacklist = current.filter(id => id !== plantId)
    return
  }
  localSettings.value.automation.friend_steal_blacklist = [...current, plantId]
}

const filteredStealCropOptions = computed(() => {
  const keyword = stealBlacklistSearch.value.trim().toLowerCase()

  return stealCropOptions.value.filter((crop) => {
    const byName = crop.name.toLowerCase().includes(keyword)
    const bySeedId = crop.seedId !== null && String(crop.seedId).includes(keyword)
    const keywordMatched = !keyword || byName || bySeedId
    const unselectedMatched = !onlyShowUnselectedStealCrops.value || !isCropBlacklisted(crop.plantId)
    return keywordMatched && unselectedMatched
  })
})

function filterUnselectedStealCrops() {
  onlyShowUnselectedStealCrops.value = !onlyShowUnselectedStealCrops.value
  if (onlyShowUnselectedStealCrops.value)
    stealBlacklistSearch.value = ''
}

function clearStealFilter() {
  onlyShowUnselectedStealCrops.value = false
  stealBlacklistSearch.value = ''
}
const localOffline = ref({
  channel: 'webhook',
  reloginUrlMode: 'none',
  endpoint: '',
  token: '',
  title: '',
  msg: '',
  offlineDeleteSec: 1,
  offlineDeleteEnabled: false,
  custom_headers: '',
  custom_body: '',
})

const localQrLogin = ref({
  apiDomain: 'q.qq.com',
})

const localRuntimeClient = ref({
  serverUrl: 'wss://gate-obt.nqf.qq.com/prod/ws',
  clientVersion: '1.6.2.18_20260227',
  os: 'iOS',
  device_info: {
    sys_software: 'iOS 26.2.1',
    network: 'wifi',
    memory: '7672',
    device_id: 'iPhone X<iPhone18,3>',
  },
})

const passwordForm = ref({
  old: '',
  new: '',
  confirm: '',
})

function syncLocalSettings() {
  if (settings.value) {
    localSettings.value = JSON.parse(JSON.stringify({
      plantingStrategy: settings.value.plantingStrategy,
      preferredSeedId: settings.value.preferredSeedId,
      bagSeedPriority: settings.value.bagSeedPriority || [],
      intervals: settings.value.intervals,
      friendQuietHours: settings.value.friendQuietHours,
      automation: settings.value.automation,
    }))

    // Default automation values if missing
    if (!localSettings.value.automation) {
      localSettings.value.automation = {
        farm: false,
        farm_manage: false,
        farm_water: false,
        farm_weed: false,
        farm_bug: false,
        task: false,
        sell: false,
        friend: false,
        farm_push: false,
        land_upgrade: false,
        friend_steal: false,
        friend_steal_blacklist: [] as number[],
        friend_help: false,
        friend_bad: false,
        friend_help_exp_limit: false,
        email: false,
        fertilizer_gift: false,
        fertilizer_buy: false,
        fertilizer_buy_type: 'organic' as string,
        fertilizer_buy_max: 10,
        fertilizer_buy_mode: 'threshold' as string,
        fertilizer_buy_threshold: 100,
        free_gifts: false,
        share_reward: false,
        vip_gift: false,
        month_card: false,
        open_server_gift: false,
        fertilizer: 'none',
        fertilizer_multi_season: false,
        fertilizer_land_types: [...allFertilizerLandTypes],
      }
    }
    else {
      // Merge with defaults to ensure all keys exist
      const defaults = {
        farm: false,
        farm_manage: false,
        farm_water: false,
        farm_weed: false,
        farm_bug: false,
        task: false,
        sell: false,
        friend: false,
        farm_push: false,
        land_upgrade: false,
        friend_steal: false,
        friend_steal_blacklist: [] as number[],
        friend_help: false,
        friend_bad: false,
        friend_help_exp_limit: false,
        email: false,
        fertilizer_gift: false,
        fertilizer_buy: false,
        fertilizer_buy_type: 'organic' as string,
        fertilizer_buy_max: 10,
        fertilizer_buy_mode: 'threshold' as string,
        fertilizer_buy_threshold: 100,
        free_gifts: false,
        share_reward: false,
        vip_gift: false,
        month_card: false,
        open_server_gift: false,
        fertilizer: 'none',
        fertilizer_multi_season: false,
        fertilizer_land_types: [...allFertilizerLandTypes],
      }
      localSettings.value.automation = {
        ...defaults,
        ...localSettings.value.automation,
      }
    }

    localSettings.value.automation.fertilizer_land_types = normalizeFertilizerLandTypes(localSettings.value.automation.fertilizer_land_types)
    localSettings.value.automation.friend_steal_blacklist = normalizeStealPlantBlacklist(localSettings.value.automation.friend_steal_blacklist)

    // Sync offline settings (global)
    if (settings.value.offlineReminder) {
      localOffline.value = {
        ...localOffline.value,
        ...JSON.parse(JSON.stringify(settings.value.offlineReminder)),
      }
    }
    localOffline.value.offlineDeleteSec = Math.max(1, Number.parseInt(String(localOffline.value.offlineDeleteSec), 10) || 1)
    localOffline.value.offlineDeleteEnabled = !!localOffline.value.offlineDeleteEnabled
    if (settings.value.qrLogin) {
      localQrLogin.value = JSON.parse(JSON.stringify(settings.value.qrLogin))
    }
    if (settings.value.runtimeClient) {
      localRuntimeClient.value = JSON.parse(JSON.stringify(settings.value.runtimeClient))
    }
  }
}

async function loadData() {
  if (currentAccountId.value) {
    await settingStore.fetchSettings(currentAccountId.value)
    syncLocalSettings()
    // Always fetch seeds to ensure correct locked status for current account
    await Promise.all([
      farmStore.fetchSeeds(currentAccountId.value),
      loadStealBlacklistAnalytics(),
    ])
  }
}

onMounted(() => {
  loadData()
  fetchPasswordAuthStatus()
})

watch(currentAccountId, () => {
  loadData()
})

const fertilizerOptions = [
  { label: '鏅€?+ 鏈夋満', value: 'both' },
  { label: '浠呮櫘閫氬寲鑲?, value: 'normal' },
  { label: '浠呮湁鏈哄寲鑲?, value: 'organic' },
  { label: '涓嶆柦鑲?, value: 'none' },
]

const plantingStrategyOptions = [
  { label: '浼樺厛鑳屽寘绉嶅瓙', value: 'bag_priority' },
  { label: '浼樺厛绉嶆绉嶅瓙', value: 'preferred' },
  { label: '鏈€楂樼瓑绾т綔鐗?, value: 'level' },
  { label: '鏈€澶х粡楠?鏃?, value: 'max_exp' },
  { label: '鏈€澶ф櫘閫氳偉缁忛獙/鏃?, value: 'max_fert_exp' },
  { label: '鏈€澶у噣鍒╂鼎/鏃?, value: 'max_profit' },
  { label: '鏈€澶ф櫘閫氳偉鍑€鍒╂鼎/鏃?, value: 'max_fert_profit' },
]

const channelOptions = [
  { label: 'Webhook(鑷畾涔夋帴鍙?', value: 'webhook' },
  { label: '鑷畾涔?JSON (Webhook)', value: 'custom_request' },
  { label: 'Qmsg 閰?, value: 'qmsg' },
  { label: 'Server 閰?, value: 'serverchan' },
  { label: 'Push Plus', value: 'pushplus' },
  { label: 'Push Plus Hxtrip', value: 'pushplushxtrip' },
  { label: '閽夐拤', value: 'dingtalk' },
  { label: '浼佷笟寰俊', value: 'wecom' },
  { label: 'Bark', value: 'bark' },
  { label: 'Go-cqhttp', value: 'gocqhttp' },
  { label: 'OneBot', value: 'onebot' },
  { label: 'Atri', value: 'atri' },
  { label: 'PushDeer', value: 'pushdeer' },
  { label: 'iGot', value: 'igot' },
  { label: 'Telegram', value: 'telegram' },
  { label: '椋炰功', value: 'feishu' },
  { label: 'IFTTT', value: 'ifttt' },
  { label: '浼佷笟寰俊缇ゆ満鍣ㄤ汉', value: 'wecombot' },
  { label: 'Discord', value: 'discord' },
  { label: 'WxPusher', value: 'wxpusher' },
]

const CHANNEL_DOCS: Record<string, string> = {
  webhook: '',
  custom_request: '',
  qmsg: 'https://qmsg.zendee.cn/',
  serverchan: 'https://sct.ftqq.com/',
  pushplus: 'https://www.pushplus.plus/',
  pushplushxtrip: 'https://pushplus.hxtrip.com/',
  dingtalk: 'https://open.dingtalk.com/document/group/custom-robot-access',
  wecom: 'https://guole.fun/posts/626/',
  wecombot: 'https://developer.work.weixin.qq.com/document/path/91770',
  bark: 'https://github.com/Finb/Bark',
  gocqhttp: 'https://docs.go-cqhttp.org/api/',
  onebot: 'https://docs.go-cqhttp.org/api/',
  atri: 'https://blog.tianli0.top/',
  pushdeer: 'https://www.pushdeer.com/',
  igot: 'https://push.hellyw.com/',
  telegram: 'https://core.telegram.org/bots',
  feishu: 'https://www.feishu.cn/hc/zh-CN/articles/360024984973',
  ifttt: 'https://ifttt.com/maker_webhooks',
  discord: 'https://discord.com/developers/docs/resources/webhook#execute-webhook',
  wxpusher: 'https://wxpusher.zjiecode.com/docs/#/',
}

const reloginUrlModeOptions = [
  { label: '涓嶉渶瑕?, value: 'none' },
  { label: '閾炬帴', value: 'qq_link' },
  { label: '浜岀淮鐮?, value: 'qr_code' },
  { label: '浜岀淮鐮?+ 閾炬帴', value: 'all' },
]

const currentChannelDocUrl = computed(() => {
  const key = String(localOffline.value.channel || '').trim().toLowerCase()
  return CHANNEL_DOCS[key] || ''
})

function openChannelDocs() {
  const url = currentChannelDocUrl.value
  if (!url)
    return
  window.open(url, '_blank', 'noopener,noreferrer')
}

const preferredSeedOptions = computed(() => {
  const options = [{ label: '鑷姩閫夋嫨', value: 0 }]
  if (seeds.value) {
    options.push(...seeds.value.map(seed => ({
      label: `${seed.requiredLevel}绾?${seed.name} (${seed.price}閲?`,
      value: seed.seedId,
      disabled: seed.locked || seed.soldOut,
    })))
  }
  return options
})

interface BagSeedItem {
  seedId: number
  name: string
  count: number
  requiredLevel: number
  image: string
  plantSize: number
}

const bagSeeds = ref<BagSeedItem[]>([])
const bagSeedsLoading = ref(false)

async function fetchBagSeeds() {
  if (!currentAccountId.value)
    return
  bagSeedsLoading.value = true
  try {
    const { data } = await api.get('/api/bag/seeds', {
      headers: { 'x-account-id': currentAccountId.value },
    })
    if (data && data.ok && Array.isArray(data.data)) {
      bagSeeds.value = data.data
    }
  }
  catch {
    bagSeeds.value = []
  }
  finally {
    bagSeedsLoading.value = false
  }
}

const sortedBagSeeds = computed(() => {
  const priority = localSettings.value.bagSeedPriority || []
  const priorityMap = new Map<number, number>()
  priority.forEach((seedId, index) => {
    priorityMap.set(seedId, index)
  })

  return [...bagSeeds.value].sort((a, b) => {
    const pa = priorityMap.has(a.seedId) ? priorityMap.get(a.seedId)! : Number.MAX_SAFE_INTEGER
    const pb = priorityMap.has(b.seedId) ? priorityMap.get(b.seedId)! : Number.MAX_SAFE_INTEGER
    if (pa !== pb)
      return pa - pb
    return b.requiredLevel - a.requiredLevel
  })
})

function moveSeedUp(index: number) {
  if (index <= 0)
    return
  const seeds = sortedBagSeeds.value
  const newPriority: number[] = seeds.map(s => s.seedId)
  const a = newPriority[index]!
  const b = newPriority[index - 1]!
  newPriority[index] = b
  newPriority[index - 1] = a
  localSettings.value.bagSeedPriority = newPriority
}

function moveSeedDown(index: number) {
  const seeds = sortedBagSeeds.value
  if (index >= seeds.length - 1)
    return
  const newPriority: number[] = seeds.map(s => s.seedId)
  const a = newPriority[index]!
  const b = newPriority[index + 1]!
  newPriority[index] = b
  newPriority[index + 1] = a
  localSettings.value.bagSeedPriority = newPriority
}

function resetBagSeedPriority() {
  localSettings.value.bagSeedPriority = []
}

const dragIndex = ref<number | null>(null)

function onDragStart(e: DragEvent, index: number) {
  dragIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
  }
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
}

function onDrop(targetIndex: number) {
  if (dragIndex.value === null || dragIndex.value === targetIndex) {
    dragIndex.value = null
    return
  }

  const seeds = sortedBagSeeds.value
  const newPriority: number[] = seeds.map(s => s.seedId)
  const draggedId = newPriority[dragIndex.value]!

  newPriority.splice(dragIndex.value, 1)
  newPriority.splice(targetIndex, 0, draggedId)

  localSettings.value.bagSeedPriority = newPriority
  dragIndex.value = null
}

function onDragEnd() {
  dragIndex.value = null
}

watch(() => localSettings.value.plantingStrategy, (newVal) => {
  if (newVal === 'bag_priority') {
    fetchBagSeeds()
  }
}, { immediate: true })

const analyticsSortByMap: Record<string, string> = {
  max_exp: 'exp',
  max_fert_exp: 'fert',
  max_profit: 'profit',
  max_fert_profit: 'fert_profit',
}

const strategyPreviewLabel = ref<string | null>(null)

watchEffect(async () => {
  const strategy = localSettings.value.plantingStrategy
  if (strategy === 'preferred' || strategy === 'bag_priority') {
    strategyPreviewLabel.value = null
    return
  }
  if (!seeds.value || seeds.value.length === 0) {
    strategyPreviewLabel.value = null
    return
  }
  const available = seeds.value.filter(s => !s.locked && !s.soldOut)
  if (available.length === 0) {
    strategyPreviewLabel.value = '鏆傛棤鍙敤绉嶅瓙'
    return
  }
  if (strategy === 'level') {
    const best = [...available].sort((a, b) => b.requiredLevel - a.requiredLevel)[0]
    strategyPreviewLabel.value = best ? `${best.requiredLevel}绾?${best.name}` : null
    return
  }
  const sortBy = analyticsSortByMap[strategy]
  if (sortBy) {
    try {
      const res = await api.get(`/api/analytics?sort=${sortBy}`)
      const rankings: any[] = res.data.ok ? (res.data.data || []) : []
      const availableIds = new Set(available.map(s => s.seedId))
      const match = rankings.find(r => availableIds.has(Number(r.seedId)))
      if (match) {
        const seed = available.find(s => s.seedId === Number(match.seedId))
        strategyPreviewLabel.value = seed ? `${seed.requiredLevel}绾?${seed.name}` : null
      }
      else {
        strategyPreviewLabel.value = '鏆傛棤鍖归厤绉嶅瓙'
      }
    }
    catch {
      strategyPreviewLabel.value = null
    }
  }
})

async function saveAccountSettings() {
  if (!currentAccountId.value)
    return

  localSettings.value.automation.fertilizer_land_types = normalizeFertilizerLandTypes(localSettings.value.automation.fertilizer_land_types)
  localSettings.value.automation.friend_steal_blacklist = normalizeStealPlantBlacklist(localSettings.value.automation.friend_steal_blacklist)
  localSettings.value.automation.fertilizer_buy_max = Math.max(1, Math.min(10, Number.parseInt(String(localSettings.value.automation.fertilizer_buy_max), 10) || 10))
  localSettings.value.automation.fertilizer_buy_threshold = Math.max(0, Number.parseInt(String(localSettings.value.automation.fertilizer_buy_threshold), 10) || 0)
  if (localSettings.value.automation.fertilizer_buy_mode === 'unlimited' && localSettings.value.automation.fertilizer_buy_type === 'both')
    localSettings.value.automation.fertilizer_buy_type = 'organic'

  saving.value = true
  try {
    const res = await settingStore.saveSettings(currentAccountId.value, localSettings.value)
    if (res.ok) {
      showAlert('璐﹀彿璁剧疆宸蹭繚瀛?)
    }
    else {
      showAlert(`淇濆瓨澶辫触: ${res.error}`, 'danger')
    }
  }
  finally {
    saving.value = false
  }
}

async function handleChangePassword() {
  if (!passwordForm.value.old || !passwordForm.value.new) {
    showAlert('璇峰～鍐欏畬鏁?, 'danger')
    return
  }
  if (passwordForm.value.new !== passwordForm.value.confirm) {
    showAlert('涓ゆ瀵嗙爜杈撳叆涓嶄竴鑷?, 'danger')
    return
  }
  if (passwordForm.value.new.length < 4) {
    showAlert('瀵嗙爜闀垮害鑷冲皯4浣?, 'danger')
    return
  }

  passwordSaving.value = true
  try {
    const res = await settingStore.changeAdminPassword(passwordForm.value.old, passwordForm.value.new)

    if (res.ok) {
      showAlert('瀵嗙爜淇敼鎴愬姛')
      passwordForm.value = { old: '', new: '', confirm: '' }
    }
    else {
      showAlert(`淇敼澶辫触: ${res.error || '鏈煡閿欒'}`, 'danger')
    }
  }
  finally {
    passwordSaving.value = false
  }
}

// 鑾峰彇瀵嗙爜璁よ瘉鐘舵€?async function fetchPasswordAuthStatus() {
  try {
    const { data } = await api.get('/api/admin/password-auth-status')
    if (data && data.ok) {
      passwordAuthDisabled.value = data.data.disabled
    }
  }
  catch (e) {
    console.error('鑾峰彇瀵嗙爜璁よ瘉鐘舵€佸け璐?', e)
  }
}

// 鍒囨崲瀵嗙爜璁よ瘉鐘舵€?async function handleTogglePasswordAuth() {
  passwordAuthLoading.value = true
  try {
    const { data } = await api.post('/api/admin/toggle-password-auth', {
      disabled: !passwordAuthDisabled.value,
    })

    if (data && data.ok) {
      passwordAuthDisabled.value = data.data.disabled
      showAlert(passwordAuthDisabled.value ? '宸茬鐢ㄥ瘑鐮佽璇? : '宸插惎鐢ㄥ瘑鐮佽璇?)
    }
    else {
      showAlert(`鎿嶄綔澶辫触: ${data?.error || '鏈煡閿欒'}`, 'danger')
    }
  }
  catch (e: any) {
    showAlert(`鎿嶄綔澶辫触: ${e?.response?.data?.error || e?.message || '鏈煡閿欒'}`, 'danger')
  }
  finally {
    passwordAuthLoading.value = false
  }
}

async function handleSaveQrLogin() {
  qrSaving.value = true
  try {
    const res = await settingStore.saveQrLoginConfig(localQrLogin.value)
    if (res.ok) {
      showAlert('浜岀淮鐮佹帴鍙ｈ缃凡淇濆瓨')
    }
    else {
      showAlert(`淇濆瓨澶辫触: ${res.error || '鏈煡閿欒'}`, 'danger')
    }
  }
  finally {
    qrSaving.value = false
  }
}
async function handleSaveRuntimeClient() {
  runtimeClientSaving.value = true
  try {
    const res = await settingStore.saveRuntimeClientConfig(localRuntimeClient.value as any)
    if (res.ok) {
      showAlert('杩愯鏃惰繛鎺ラ厤缃凡淇濆瓨锛岃繍琛屼腑璐﹀彿灏嗚嚜鍔ㄩ噸杩炵敓鏁?)
    }
    else {
      showAlert(`淇濆瓨澶辫触: ${res.error || '鏈煡閿欒'}`, 'danger')
    }
  }
  finally {
    runtimeClientSaving.value = false
  }
}

async function handleSaveOffline() {
  localOffline.value.offlineDeleteSec = Math.max(1, Number.parseInt(String(localOffline.value.offlineDeleteSec), 10) || 1)
  localOffline.value.offlineDeleteEnabled = !!localOffline.value.offlineDeleteEnabled

  offlineSaving.value = true
  try {
    const res = await settingStore.saveOfflineConfig(localOffline.value)

    if (res.ok) {
      showAlert('涓嬬嚎鎻愰啋璁剧疆宸蹭繚瀛?)
    }
    else {
      showAlert(`淇濆瓨澶辫触: ${res.error || '鏈煡閿欒'}`, 'danger')
    }
  }
  finally {
    offlineSaving.value = false
  }
}

async function handleTestOffline() {
  offlineTesting.value = true
  try {
    const { data } = await api.post('/api/settings/offline-reminder/test', localOffline.value)
    if (data?.ok) {
      showAlert('娴嬭瘯娑堟伅鍙戦€佹垚鍔?)
    }
    else {
      showAlert(`娴嬭瘯澶辫触: ${data?.error || '鏈煡閿欒'}`, 'danger')
    }
  }
  catch (e: any) {
    const msg = e?.response?.data?.error || e?.message || '璇锋眰澶辫触'
    showAlert(`娴嬭瘯澶辫触: ${msg}`, 'danger')
  }
  finally {
    offlineTesting.value = false
  }
}
</script>

<template>
  <div class="settings-page">
    <div v-if="loading" class="py-4 text-center text-gray-500">
      <div class="i-svg-spinners-ring-resize mx-auto mb-2 text-2xl" />
      <p>鍔犺浇涓?..</p>
    </div>

    <div v-else class="grid grid-cols-1 mt-12 gap-4 text-sm lg:grid-cols-2">
      <!-- Card 1: Strategy & Automation -->
      <div v-if="currentAccountId" class="card h-full flex flex-col rounded-lg bg-white shadow dark:bg-gray-800">
        <!-- Strategy Header -->
        <div class="border-b bg-gray-50/50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
          <h3 class="flex items-center gap-2 text-base text-gray-900 font-bold dark:text-gray-100">
            <div class="i-fas-cogs" />
            绛栫暐璁剧疆
            <span v-if="currentAccountName" class="ml-2 text-sm text-gray-500 font-normal dark:text-gray-400">
              ({{ currentAccountName }})
            </span>
          </h3>
        </div>

        <!-- Strategy Content -->
        <div class="p-4 space-y-3">
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <BaseSelect
              v-model="localSettings.plantingStrategy"
              label="绉嶆绛栫暐"
              :options="plantingStrategyOptions"
            />
            <BaseSelect
              v-if="localSettings.plantingStrategy === 'preferred'"
              v-model="localSettings.preferredSeedId"
              label="浼樺厛绉嶆绉嶅瓙"
              :options="preferredSeedOptions"
            />
            <!-- 棰勮鍖哄煙锛氫笌 BaseSelect 鍚岀粨鏋勫悓鏍峰紡锛岄伩鍏嶅垏鎹㈢瓥鐣ユ椂甯冨眬璺冲姩 -->
            <div v-else-if="localSettings.plantingStrategy !== 'bag_priority'" class="flex flex-col gap-1.5">
              <label class="text-sm text-gray-700 font-medium dark:text-gray-300">绛栫暐閫夌棰勮</label>
              <div
                class="w-full flex items-center justify-between border border-gray-200 rounded-lg bg-gray-50 px-3 py-2 text-gray-500 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-400"
              >
                <span class="truncate">{{ strategyPreviewLabel ?? '鍔犺浇涓?..' }}</span>
                <div class="i-carbon-chevron-down shrink-0 text-lg text-gray-400" />
              </div>
            </div>
          </div>

          <!-- 鑳屽寘绉嶅瓙浼樺厛绾у垪琛?-->
          <div v-if="localSettings.plantingStrategy === 'bag_priority'" class="mt-3">
            <div class="mb-2 flex items-center justify-between">
              <label class="text-sm text-gray-700 font-medium dark:text-gray-300">鑳屽寘绉嶅瓙浼樺厛绾?/label>
              <div class="flex items-center gap-2">
                <button
                  class="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600"
                  @click="fetchBagSeeds"
                >
                  鍒锋柊
                </button>
                <button
                  class="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-600"
                  @click="resetBagSeedPriority"
                >
                  閲嶇疆鎺掑簭
                </button>
              </div>
            </div>

            <div v-if="bagSeedsLoading" class="py-4 text-center text-gray-500">
              鍔犺浇涓?..
            </div>
            <div v-else-if="sortedBagSeeds.length === 0" class="py-4 text-center text-gray-500 dark:text-gray-400">
              鑳屽寘涓殏鏃犵瀛?            </div>
            <div v-else class="max-h-64 overflow-y-auto space-y-1">
              <div
                v-for="(seed, index) in sortedBagSeeds"
                :key="seed.seedId"
                draggable="true"
                class="flex cursor-grab select-none items-center gap-3 border border-gray-200 rounded-lg bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-800/50"
                @dragstart="onDragStart($event, index)"
                @dragover="onDragOver"
                @drop="onDrop(index)"
                @dragend="onDragEnd"
              >
                <div class="flex items-center gap-1 text-gray-400 dark:text-gray-500">
                  <div class="i-carbon-draggable text-lg" />
                  <span class="w-5 text-center text-sm font-medium">{{ index + 1 }}</span>
                </div>
                <img
                  v-if="seed.image"
                  :src="seed.image"
                  :alt="seed.name"
                  class="pointer-events-none h-8 w-8 object-contain"
                >
                <div v-else class="pointer-events-none h-8 w-8 rounded bg-gray-200 dark:bg-gray-700" />
                <div class="pointer-events-none min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span
                      v-if="seed.requiredLevel >= 200"
                      class="rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400"
                    >娲诲姩</span>
                    <span class="truncate text-sm text-gray-800 font-medium dark:text-gray-200">{{ seed.name }}</span>
                  </div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">
                    鏁伴噺: {{ seed.count }} | {{ seed.requiredLevel >= 200 ? '娲诲姩绉嶅瓙' : `${seed.requiredLevel}绾 }}
                    <span v-if="seed.plantSize > 1"> | {{ seed.plantSize }}x{{ seed.plantSize }}</span>
                  </div>
                </div>
                <div class="flex flex-col gap-1">
                  <button
                    class="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 dark:hover:text-gray-300"
                    :disabled="index === 0"
                    @click.stop="moveSeedUp(index)"
                  >
                    <div class="i-carbon-chevron-up" />
                  </button>
                  <button
                    class="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 dark:hover:text-gray-300"
                    :disabled="index === sortedBagSeeds.length - 1"
                    @click.stop="moveSeedDown(index)"
                  >
                    <div class="i-carbon-chevron-down" />
                  </button>
                </div>
              </div>
            </div>
            <div class="mt-2 text-xs text-gray-500 space-y-1 dark:text-gray-400">
              <p>* 鎷栨嫿鎴栫偣鍑荤澶磋皟鏁寸妞嶄紭鍏堢骇</p>
              <p>* 浠呮敮鎸?1x1 绉嶅瓙锛?x2 鍙婁互涓婄瀛愪細琚烦杩?/p>
              <p>* 1x1 绉嶅瓙鐢ㄥ畬鍚庡皢鑷姩鍒囨崲涓?鏈€楂樼瓑绾?绛栫暐</p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
            <BaseInput
              v-model.number="localSettings.intervals.farmMin"
              label="鍐滃満宸℃煡鏈€灏?(绉?"
              type="number"
              min="1"
              max="86400"
            />
            <BaseInput
              v-model.number="localSettings.intervals.farmMax"
              label="鍐滃満宸℃煡鏈€澶?(绉?"
              type="number"
              min="1"
              max="86400"
            />
            <BaseInput
              v-model.number="localSettings.intervals.friendMin"
              label="濂藉弸宸℃煡鏈€灏?(绉?"
              type="number"
              min="1"
              max="86400"
            />
            <BaseInput
              v-model.number="localSettings.intervals.friendMax"
              label="濂藉弸宸℃煡鏈€澶?(绉?"
              type="number"
              min="1"
              max="86400"
            />
          </div>

          <div class="mt-4 flex flex-wrap items-center gap-4 border-t pt-3 dark:border-gray-700">
            <BaseSwitch
              v-model="localSettings.friendQuietHours.enabled"
              label="鍚敤闈欓粯鏃舵"
            />
            <div class="flex items-center gap-2">
              <BaseInput
                v-model="localSettings.friendQuietHours.start"
                type="time"
                class="w-24"
                :disabled="!localSettings.friendQuietHours.enabled"
              />
              <span class="text-gray-500">-</span>
              <BaseInput
                v-model="localSettings.friendQuietHours.end"
                type="time"
                class="w-24"
                :disabled="!localSettings.friendQuietHours.enabled"
              />
            </div>
          </div>
        </div>

        <!-- Auto Control Header -->
        <div class="border-b border-t bg-gray-50/50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
          <h3 class="flex items-center gap-2 text-base text-gray-900 font-bold dark:text-gray-100">
            <div class="i-fas-toggle-on" />
            鑷姩鎺у埗
          </h3>
        </div>

        <!-- Auto Control Content -->
        <div class="flex-1 p-4 space-y-4">
          <!-- Switches Grid -->
          <div class="grid grid-cols-2 gap-3 md:grid-cols-3">
            <BaseSwitch v-model="localSettings.automation.farm" label="鑷姩绉嶆鏀惰幏" />
            <BaseSwitch v-model="localSettings.automation.farm_manage" label="鑷姩鎵撶悊鍐滃満" />
            <BaseSwitch v-model="localSettings.automation.task" label="鑷姩鍋氫换鍔? />
            <BaseSwitch v-model="localSettings.automation.sell" label="鑷姩鍗栨灉瀹? />
            <BaseSwitch v-model="localSettings.automation.friend" label="鑷姩濂藉弸浜掑姩" />
            <BaseSwitch v-model="localSettings.automation.farm_push" label="鎺ㄩ€佽Е鍙戝贰鐢? />
            <BaseSwitch v-model="localSettings.automation.land_upgrade" label="鑷姩鍗囩骇鍦熷湴" />
            <BaseSwitch v-model="localSettings.automation.email" label="鑷姩棰嗗彇閭欢" />
            <BaseSwitch v-model="localSettings.automation.free_gifts" label="鑷姩鍟嗗煄绀煎寘" />
            <BaseSwitch v-model="localSettings.automation.share_reward" label="鑷姩鍒嗕韩濂栧姳" />
            <BaseSwitch v-model="localSettings.automation.vip_gift" label="鑷姩VIP绀煎寘" />
            <BaseSwitch v-model="localSettings.automation.month_card" label="鑷姩鏈堝崱濂栧姳" />
            <BaseSwitch v-model="localSettings.automation.open_server_gift" label="鑷姩寮€鏈嶇孩鍖? />
            <BaseSwitch v-model="localSettings.automation.fertilizer_gift" label="鑷姩濉厖鍖栬偉" />
            <BaseSwitch v-model="localSettings.automation.fertilizer_buy" label="鑷姩璐拱鍖栬偉" />
          </div>

          <div v-if="localSettings.automation.fertilizer_buy" class="border border-cyan-200 rounded bg-cyan-50/60 p-3 dark:border-cyan-800/60 dark:bg-cyan-900/10">
            <div class="mb-2 text-sm text-cyan-800 font-medium dark:text-cyan-300">
              璐拱鍖栬偉閰嶇疆
            </div>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
              <BaseSelect
                v-model="localSettings.automation.fertilizer_buy_type"
                label="璐拱绉嶇被"
                :options="fertilizerBuyTypeOptions"
              />
              <BaseSelect
                v-model="localSettings.automation.fertilizer_buy_mode"
                label="璐拱鏉′欢"
                :options="fertilizerBuyModeOptions"
              />
            </div>
            <div class="grid grid-cols-1 mt-3 gap-3 md:grid-cols-2">
              <BaseInput
                v-model.number="localSettings.automation.fertilizer_buy_max"
                label="鏈疆鏈€澶氳喘涔版€绘暟锛堜釜锛?
                type="number"
                min="1"
                max="10"
              />
              <BaseInput
                v-if="localSettings.automation.fertilizer_buy_mode === 'threshold'"
                v-model.number="localSettings.automation.fertilizer_buy_threshold"
                label="瀹瑰櫒浣庝簬姝ゅ皬鏃舵暟鏃惰喘涔?
                type="number"
                min="0"
              />
            </div>
            <p v-if="localSettings.automation.fertilizer_buy_mode === 'threshold'" class="mt-2 text-xs text-cyan-700 dark:text-cyan-300">
              闃堝€间负 0 琛ㄧず瀹瑰櫒绌轰簡鍐嶄拱銆?            </p>
            <p v-if="localSettings.automation.fertilizer_buy_mode === 'unlimited'" class="mt-2 text-xs text-amber-600 dark:text-amber-400">
              鏃犻檺璐拱妯″紡涓嬩笉鑳藉悓鏃堕€夋嫨涓ょ鍖栬偉
            </p>
          </div>

          <!-- Sub-controls -->
          <div class="flex flex-wrap gap-4 rounded bg-emerald-50 p-2 text-sm dark:bg-emerald-900/20" :class="{ 'opacity-50 pointer-events-none': farmDisabled }">
            <BaseSwitch v-model="localSettings.automation.farm_water" label="鑷姩娴囨按" :disabled="farmDisabled" />
            <BaseSwitch v-model="localSettings.automation.farm_bug" label="鑷姩闄よ櫕" :disabled="farmDisabled" />
            <BaseSwitch v-model="localSettings.automation.farm_weed" label="鑷姩闄よ崏" :disabled="farmDisabled" />
          </div>

          <div class="flex flex-wrap gap-4 rounded bg-blue-50 p-2 text-sm dark:bg-blue-900/20" :class="{ 'opacity-50 pointer-events-none': friendDisabled }">
            <BaseSwitch v-model="localSettings.automation.friend_steal" label="鑷姩鍋疯彍" :disabled="friendDisabled" />
            <BaseSwitch v-model="localSettings.automation.friend_help" label="鑷姩甯繖" :disabled="friendDisabled" />
            <BaseSwitch v-model="localSettings.automation.friend_bad" label="鑷姩鎹ｄ贡" :disabled="friendDisabled" />
            <BaseSwitch v-model="localSettings.automation.friend_help_exp_limit" label="缁忛獙涓婇檺鍋滄甯繖" :disabled="friendDisabled" />
          </div>
          <!-- Steal Crop Blacklist + Fertilizer -->
          <div class="space-y-3">
            <div class="border border-blue-200 rounded-lg bg-blue-50/70 p-3 text-gray-800 shadow-sm dark:border-blue-500/50 dark:bg-[#17243a] dark:text-white">
              <div class="mb-1 flex items-center justify-between gap-3">
                <div class="min-w-0 flex items-center gap-2">
                  <div class="h-9 w-9 flex items-center justify-center border border-blue-300/70 rounded-lg bg-white/90 dark:border-blue-500/40 dark:bg-blue-500/20">
                    <div class="i-carbon-filter text-xl text-blue-700 dark:text-blue-200" />
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <div class="truncate text-base font-semibold">
                        鎺掗櫎浣滅墿
                      </div>
                      <div class="border border-blue-300 rounded-full bg-white/95 px-2 py-0.5 text-xs text-blue-700 shadow-sm dark:border-blue-300/60 dark:bg-blue-500/15 dark:text-blue-100">
                        <span class="font-semibold">{{ stealBlacklistCount }} / {{ stealCropOptions.length }}</span>
                      </div>
                    </div>
                    <p class="text-xs text-blue-700/90 dark:text-blue-200/85">
                      鍕鹃€夊悗锛岃嚜鍔ㄥ伔鑿滀細璺宠繃杩欎簺浣滅墿锛?                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  class="h-9 w-9 flex items-center justify-center border border-blue-300/70 rounded-lg bg-white/90 text-blue-700 transition dark:border-blue-500/40 dark:bg-blue-500/20 hover:bg-blue-100 dark:text-blue-100 dark:hover:bg-blue-500/30"
                  :aria-expanded="!stealBlacklistCollapsed"
                  @click="stealBlacklistCollapsed = !stealBlacklistCollapsed"
                >
                  <div
                    class="i-carbon-chevron-down text-lg transition-transform"
                    :class="stealBlacklistCollapsed ? '' : 'rotate-180'"
                  />
                </button>
              </div>

              <div v-if="!stealBlacklistCollapsed">
                <div class="my-2 border-t border-blue-200/80 dark:border-blue-400/30" />

                <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div class="text-xs text-blue-700/90 dark:text-blue-200/90">
                    鏀寔鎸変綔鐗╁悕鎴?seedid 鎼滅储
                  </div>
                  <div class="flex items-center justify-end gap-2">
                    <BaseButton
                      variant="outline"
                      size="sm"
                      class="!border-blue-300 !text-blue-700 dark:!border-blue-400/70 hover:!bg-blue-100 dark:!text-blue-100 dark:hover:!bg-blue-500/20"
                      :disabled="stealBlacklistCount >= stealCropOptions.length"
                      @click="filterUnselectedStealCrops"
                    >
                      鎺掗櫎绛涢€?                    </BaseButton>
                    <BaseButton
                      variant="ghost"
                      size="sm"
                      class="!text-blue-700 hover:!bg-blue-100 dark:!text-blue-100 dark:hover:!bg-blue-500/20"
                      :disabled="!stealBlacklistSearch && !onlyShowUnselectedStealCrops"
                      @click="clearStealFilter"
                    >
                      娓呯┖
                    </BaseButton>
                  </div>
                </div>

                <div class="relative mb-2">
                  <div class="pointer-events-none absolute left-3 top-1/2 text-base text-blue-500/70 -translate-y-1/2 dark:text-blue-200/70">
                    <div class="i-carbon-search" />
                  </div>
                  <input
                    v-model="stealBlacklistSearch"
                    type="text"
                    placeholder="鎼滅储浣滅墿鍚嶆垨 Seed ID"
                    class="w-full border border-blue-200 rounded-lg bg-white py-2 pl-9 pr-3 text-sm text-gray-700 outline-none dark:border-blue-400/40 focus:border-blue-400 dark:bg-[#1c2b45] dark:text-blue-50 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-300/20 dark:focus:border-blue-300/70 dark:placeholder:text-blue-200/50"
                  >
                </div>

                <div v-if="stealCropOptions.length > 0">
                  <div
                    v-if="filteredStealCropOptions.length > 0"
                    class="grid grid-cols-1 max-h-56 gap-2 overflow-y-auto pr-1 lg:grid-cols-3 sm:grid-cols-2"
                  >
                    <button
                      v-for="crop in filteredStealCropOptions"
                      :key="crop.plantId"
                      type="button"
                      class="w-full flex cursor-pointer items-center gap-2 border rounded bg-white px-2 py-1.5 text-left text-xs text-gray-700 transition dark:bg-gray-800 dark:text-gray-300"
                      :class="isCropBlacklisted(crop.plantId)
                        ? 'border-blue-500 ring-1 ring-blue-300/70 dark:border-blue-400 dark:ring-blue-700/50'
                        : 'border-gray-200 hover:border-blue-300 dark:border-gray-700 dark:hover:border-blue-700'"
                      :aria-pressed="isCropBlacklisted(crop.plantId)"
                      @click="toggleStealBlacklistCrop(crop.plantId)"
                    >
                      <img
                        v-if="crop.image"
                        :src="crop.image"
                        :alt="crop.name"
                        class="h-[1.8rem] w-[1.8rem] rounded object-cover"
                      >
                      <div v-else class="h-[1.8rem] w-[1.8rem] flex items-center justify-center rounded bg-gray-100 text-[10px] text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                        <div class="i-carbon-image" />
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="truncate text-xs font-medium">
                          {{ crop.name }}
                        </div>
                        <div class="text-[11px] text-gray-500 dark:text-gray-400">
                          Seed ID: {{ crop.seedId === null ? '?' : crop.seedId }}   Lv.{{ crop.level === null ? '?' : crop.level }}
                        </div>
                      </div>
                    </button>
                  </div>
                  <div v-else class="rounded bg-white px-2 py-2 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    鏈壘鍒板尮閰嶄綔鐗╋紝璇疯皟鏁村叧閿瘝鍚庨噸璇曘€?                  </div>
                </div>
                <div v-else class="rounded bg-white px-2 py-2 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  鏆傛棤鍙€変綔鐗╋紝璇峰厛绛夊緟绉嶅瓙鍒楄〃鍔犺浇瀹屾垚銆?                </div>
              </div>
            </div>
            <div class="border border-amber-200 rounded bg-amber-50/60 p-3 dark:border-amber-800/60 dark:bg-amber-900/10">
              <div class="mb-2 text-sm text-amber-800 font-medium dark:text-amber-300">
                鏂借偉鑼冨洿
              </div>
              <div class="grid grid-cols-2 gap-2 md:grid-cols-4">
                <label
                  v-for="option in fertilizerLandTypeOptions"
                  :key="option.value"
                  class="flex cursor-pointer items-center gap-1.5 rounded bg-white px-2 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >
                  <input
                    v-model="localSettings.automation.fertilizer_land_types"
                    :value="option.value"
                    type="checkbox"
                    class="h-3.5 w-3.5"
                  >
                  <span>{{ option.label }}</span>
                </label>
              </div>
              <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                鏂借偉鍓嶄細浼樺厛鎸夊湡鍦扮被鍨嬭繃婊わ紝浠呭鍛戒腑鑼冨洿鐨勫湴鍧楁墽琛屾柦鑲ョ瓥鐣ャ€?              </p>
            </div>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <BaseSelect
                v-model="localSettings.automation.fertilizer"
                label="鏂借偉绛栫暐"
                class="w-full"
                :options="fertilizerOptions"
              />
              <BaseSwitch
                v-model="localSettings.automation.fertilizer_multi_season"
                label="澶氬琛ヨ偉"
                class="md:mb-2"
              />
            </div>
          </div>
        </div>

        <!-- Save Button -->
        <div class="mt-auto flex justify-end border-t bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/50">
          <BaseButton
            variant="primary"
            size="sm"
            :loading="saving"
            @click="saveAccountSettings"
          >
            淇濆瓨绛栫暐涓庤嚜鍔ㄦ帶鍒?          </BaseButton>
        </div>
      </div>

      <div v-else class="card flex flex-col items-center justify-center gap-4 rounded-lg bg-white p-12 text-center shadow dark:bg-gray-800">
        <div class="rounded-full bg-gray-50 p-4 dark:bg-gray-700/50">
          <div class="i-carbon-settings-adjust text-4xl text-gray-400 dark:text-gray-500" />
        </div>
        <div class="max-w-xs">
          <h3 class="text-lg text-gray-900 font-medium dark:text-gray-100">
            闇€瑕佺櫥褰曡处鍙?          </h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            璇峰厛鐧诲綍璐﹀彿浠ラ厤缃瓥鐣ュ拰鑷姩鍖栭€夐」銆?          </p>
        </div>
      </div>

      <!-- Card 2: System Settings (Password & Offline) -->
      <div class="card h-full flex flex-col rounded-lg bg-white shadow dark:bg-gray-800">
        <!-- Password Header -->
        <div class="border-b bg-gray-50/50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
          <h3 class="flex items-center gap-2 text-base text-gray-900 font-bold dark:text-gray-100">
            <div class="i-carbon-password" />
            绠＄悊瀵嗙爜
          </h3>
        </div>

        <!-- Password Content -->
        <div class="p-4 space-y-3">
          <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
            <BaseInput
              v-model="passwordForm.old"
              label="褰撳墠瀵嗙爜"
              type="password"
              placeholder="褰撳墠绠＄悊瀵嗙爜"
            />
            <BaseInput
              v-model="passwordForm.new"
              label="鏂板瘑鐮?
              type="password"
              placeholder="鑷冲皯 4 浣?
            />
            <BaseInput
              v-model="passwordForm.confirm"
              label="纭鏂板瘑鐮?
              type="password"
              placeholder="鍐嶆杈撳叆鏂板瘑鐮?
            />
          </div>

          <div class="flex items-center justify-between pt-1">
            <p class="text-xs text-gray-500">
              寤鸿淇敼榛樿瀵嗙爜 (admin)
            </p>
            <BaseButton
              variant="primary"
              size="sm"
              :loading="passwordSaving"
              @click="handleChangePassword"
            >
              淇敼绠＄悊瀵嗙爜
            </BaseButton>
          </div>

          <!-- 鍙栨秷瀵嗙爜璁块棶鍔熻兘 -->
          <div class="mt-4 border-t pt-4 dark:border-gray-700">
            <div class="mb-3 flex items-center justify-between">
              <div>
                <h4 class="text-sm text-gray-900 font-medium dark:text-gray-100">
                  鍙栨秷瀵嗙爜璁块棶
                </h4>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  寮€鍚悗鏃犻渶杈撳叆绠＄悊鍛樺瘑鐮佸嵆鍙洿鎺ヨ繘鍏ョ晫闈?                </p>
              </div>
              <BaseSwitch
                :model-value="passwordAuthDisabled"
                :disabled="passwordAuthLoading"
                @update:model-value="handleTogglePasswordAuth"
              />
            </div>

            <div v-if="passwordAuthDisabled" class="mt-2 rounded bg-orange-50 p-2 text-xs text-orange-700 dark:bg-orange-900/20 dark:text-orange-300">
              <div class="flex items-center gap-1">
                <div class="i-carbon-warning-alt" />
                <span>瀹夊叏鎻愰啋锛氬凡绂佺敤瀵嗙爜璁よ瘉锛屼换浣曚汉閮藉彲浠ヨ闂鐞嗛潰鏉?/span>
              </div>
            </div>
          </div>
        </div>

        <!-- QR Login Header -->
        <div class="border-b border-t bg-gray-50/50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
          <h3 class="flex items-center gap-2 text-base text-gray-900 font-bold dark:text-gray-100">
            <div class="i-carbon-connection-signal" />
            杩愯鏃惰繛鎺ラ厤缃?          </h3>
        </div>

        <!-- Runtime Client Content -->
        <div class="p-4 space-y-3">
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <BaseInput
              v-model="localRuntimeClient.serverUrl"
              label="鏈嶅姟鍣?WS 鍦板潃"
              type="text"
              placeholder="wss://.../ws"
            />
            <BaseInput
              v-model="localRuntimeClient.clientVersion"
              label="娓告垙鐗堟湰鍙?
              type="text"
              placeholder="渚嬪: 1.6.2.18_20260227"
            />
          </div>

          <BaseSelect
            v-model="localRuntimeClient.os"
            label="绯荤粺 (os)"
            :options="[{ label: 'iOS', value: 'iOS' }, { label: 'Android', value: 'Android' }]"
          />

          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <BaseInput
              v-model="localRuntimeClient.device_info.sys_software"
              label="绯荤粺鐗堟湰鍙?
              type="text"
              placeholder="渚嬪: iOS 26.2.1"
            />
            <BaseInput
              v-model="localRuntimeClient.device_info.network"
              label="缃戠粶绫诲瀷"
              type="text"
              placeholder="渚嬪: wifi"
            />
          </div>

          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <BaseInput
              v-model="localRuntimeClient.device_info.memory"
              label="鍐呭瓨澶у皬锛堝崟浣峂B锛?
              type="text"
              placeholder="渚嬪: 7672"
            />
            <BaseInput
              v-model="localRuntimeClient.device_info.device_id"
              label="璁惧ID"
              type="text"
              placeholder="渚嬪: iPhone X<iPhone18,3>"
            />
          </div>

          <p class="text-xs text-gray-500 dark:text-gray-400">
            淇濆瓨鍚庯紝杩愯涓殑璐﹀彿浼氳嚜鍔ㄩ噸杩炰互鐢熸晥銆?          </p>

          <div class="flex justify-end">
            <BaseButton
              variant="primary"
              size="sm"
              :loading="runtimeClientSaving"
              @click="handleSaveRuntimeClient"
            >
              淇濆瓨杩愯鏃惰繛鎺ラ厤缃?            </BaseButton>
          </div>
        </div>

        <!-- QR Login Header -->
        <div class="border-b border-t bg-gray-50/50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
          <h3 class="flex items-center gap-2 text-base text-gray-900 font-bold dark:text-gray-100">
            <div class="i-carbon-qr-code" />
            浜岀淮鐮佺櫥褰曟帴鍙?          </h3>
        </div>

        <!-- QR Login Content -->
        <div class="p-4 space-y-3">
          <BaseInput
            v-model="localQrLogin.apiDomain"
            label="浜岀淮鐮佹帴鍙ｅ煙鍚?
            type="text"
            placeholder="q.qq.com"
          />
          <p class="text-xs text-gray-500 dark:text-gray-400">
            浠呭奖鍝嶅悗绔皟鐢ㄤ簩缁寸爜鐩稿叧鎺ュ彛鐨勫煙鍚嶏紝鍓嶇浠嶄娇鐢?/api/qr/create 涓?/api/qr/check銆?          </p>
          <div class="flex justify-end">
            <BaseButton
              variant="primary"
              size="sm"
              :loading="qrSaving"
              @click="handleSaveQrLogin"
            >
              淇濆瓨浜岀淮鐮佹帴鍙ｈ缃?            </BaseButton>
          </div>
        </div>
        <!-- Offline Header -->
        <div class="border-b bg-gray-50/50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
          <h3 class="flex items-center gap-2 text-base text-gray-900 font-bold dark:text-gray-100">
            <div class="i-carbon-notification" />
            涓嬬嚎鎻愰啋
          </h3>
        </div>

        <!-- Offline Content -->
        <div class="flex-1 p-4 space-y-3">
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-700 font-medium dark:text-gray-300">鎺ㄩ€佹笭閬?/span>
                <BaseButton
                  variant="text"
                  size="sm"
                  :disabled="!currentChannelDocUrl"
                  @click="openChannelDocs"
                >
                  瀹樼綉
                </BaseButton>
              </div>
              <BaseSelect
                v-model="localOffline.channel"
                :options="channelOptions"
              />
            </div>
            <BaseSelect
              v-model="localOffline.reloginUrlMode"
              label="閲嶇櫥褰曢摼鎺?
              :options="reloginUrlModeOptions"
            />
          </div>

          <BaseInput
            v-model="localOffline.endpoint"
            label="鎺ュ彛鍦板潃"
            type="text"
            :disabled="localOffline.channel !== 'webhook' && localOffline.channel !== 'custom_request'"
          />

          <BaseInput
            v-model="localOffline.token"
            label="Token"
            type="text"
            placeholder="鎺ユ敹绔?token"
          />

          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <BaseInput
              v-model="localOffline.title"
              label="鏍囬"
              type="text"
              placeholder="鎻愰啋鏍囬"
            />
            <div class="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <BaseInput
                v-model.number="localOffline.offlineDeleteSec"
                label="绂荤嚎鍒犻櫎璐﹀彿 (绉?"
                type="number"
                min="1"
                placeholder="榛樿 1"
              />
              <BaseSwitch
                v-model="localOffline.offlineDeleteEnabled"
                label="鍚敤绂荤嚎鍒犲彿"
                class="md:mb-2"
              />
            </div>
          </div>

          <BaseInput
            v-model="localOffline.msg"
            label="鍐呭"
            type="text"
            placeholder="鎻愰啋鍐呭"
          />

          <template v-if="localOffline.channel === 'custom_request'">
            <BaseTextarea
              v-model="localOffline.custom_headers"
              label="Headers (涓ユ牸 JSON)"
              placeholder="渚嬪: {&quot;Content-Type&quot;: &quot;application/json&quot;, &quot;Authorization&quot;: &quot;Bearer TOKEN&quot;}"
            />
            <BaseTextarea
              v-model="localOffline.custom_body"
              label="Body (涓ユ牸 JSON, 鍗犱綅绗︽敮鎸?{{title}}锛堟爣棰橈級 {{content}}锛堝唴瀹癸級)"
              placeholder="渚嬪: { &quot;title&quot;: &quot;{{title}}&quot;, &quot;message&quot;: &quot;{{content}}&quot; }"
            />
          </template>

          <!-- Save Offline Button -->
          <div class="flex justify-end gap-2 pt-3">
            <BaseButton
              variant="secondary"
              size="sm"
              :loading="offlineTesting"
              :disabled="offlineSaving"
              @click="handleTestOffline"
            >
              娴嬭瘯閫氱煡
            </BaseButton>
            <BaseButton
              variant="primary"
              size="sm"
              :loading="offlineSaving"
              :disabled="offlineTesting"
              @click="handleSaveOffline"
            >
              淇濆瓨涓嬬嚎鎻愰啋璁剧疆
            </BaseButton>
          </div>
        </div>

        <!-- Token Info Header -->
        <div class="border-t bg-gray-50/50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
          <h3 class="flex items-center gap-2 text-base text-gray-900 font-bold dark:text-gray-100">
            <div class="i-carbon-code" />
            璇锋眰鍙傛暟淇℃伅
          </h3>
        </div>

        <!-- Token Info Content -->
        <div class="p-4 space-y-3">
          <div class="flex items-center gap-2">
            <input
              type="text"
              :value="token"
              readonly
              class="flex-1 border border-gray-200 rounded-lg bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
            <BaseButton
              v-if="token !== '鏈櫥褰?"
              variant="secondary"
              size="sm"
              @click="copyToClipboard(token)"
            >
              <div class="i-carbon-copy mr-1" />
              澶嶅埗
            </BaseButton>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            x-admin-token 鐢ㄤ簬API璇锋眰璁よ瘉锛屽鍒跺悗鍙敤浜庣涓夋柟宸ュ叿璋冪敤鎺ュ彛銆?          </p>
        </div>
      </div>
    </div>

    <ConfirmModal
      :show="modalVisible"
      :title="modalConfig.title"
      :message="modalConfig.message"
      :type="modalConfig.type"
      :is-alert="modalConfig.isAlert"
      confirm-text="鐭ラ亾浜?
      @confirm="modalVisible = false"
      @cancel="modalVisible = false"
    />
  </div>
</template>

<style scoped lang="postcss">
/* 绉嶅瓙鍒楄〃鎷栨嫿鎺掑簭鍔ㄧ敾 */
</style>
