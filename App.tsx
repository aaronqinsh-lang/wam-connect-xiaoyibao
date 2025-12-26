
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  MapPin, 
  MessageCircle, 
  Bell, 
  Heart, 
  RefreshCcw,
  Copy,
  ChevronRight,
  User,
  ChevronLeft,
  Save,
  LocateFixed,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  ExternalLink,
  PlusCircle,
  Image as ImageIcon,
  Trash2,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import { UserProfile, UserRole, LocationState } from './types';
import { getDailyEncouragement, getIceBreaker } from './services/geminiService';
import { supabase } from './lib/supabase';

const STORAGE_KEY = 'warm_connect_user_id';
const LOGO_UPLOAD_KEY = 'warm_connect_custom_logos';
const IGNORED_USERS_KEY = 'warm_connect_ignored_users';

const INITIAL_LOGOS = ['./image_2.png', './image_3.png', './image_1.png', './image.png'];
const SHAPE_COLLECTION = ['rounded-full', 'rounded-none', 'rounded-2xl', 'rounded-[40px]'];
const BG_COLLECTION = ['bg-brand-light', 'bg-slate-50', 'bg-accent-light/40', 'bg-white', 'bg-emerald-50'];

/**
 * 暖心 Logo 组件
 */
const WarmLogo: React.FC<{ size: string, config: any, className?: string, onClick?: () => void }> = ({ size, config, className = "", onClick }) => {
  const [hasError, setHasError] = useState(false);
  return (
    <div 
      onClick={onClick}
      className={`${size} ${config.shape} ${config.bg} ${config.rotation} overflow-hidden shadow-sm border border-brand/10 p-2 flex items-center justify-center transition-all duration-500 cursor-pointer ${className}`}
    >
      {!hasError ? (
        <img 
          src={config.url} 
          alt="Logo" 
          className="w-full h-full object-contain pointer-events-none"
          onError={() => setHasError(true)}
        />
      ) : (
        <Heart className="w-1/2 h-1/2 text-brand fill-brand/20 animate-pulse" />
      )}
    </div>
  );
};

const App: React.FC = () => {
  // --- 状态定义 ---
  const [view, setView] = useState<'home' | 'nearby' | 'messages' | 'profile' | 'setup' | 'edit-profile'>('home');
  const [me, setMe] = useState<UserProfile | null>(null);
  const [nearbyUsers, setNearbyUsers] = useState<UserProfile[]>([]);
  const [ignoredUserIds, setIgnoredUserIds] = useState<string[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [location, setLocation] = useState<LocationState | null>(null);
  const [encouragement, setEncouragement] = useState<string>('生命因互助而温暖。');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showMeetupModal, setShowMeetupModal] = useState<UserProfile | null>(null);
  const [iceBreakerMsg, setIceBreakerMsg] = useState('');
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  const [customLogos, setCustomLogos] = useState<string[]>([]);
  const [logoConfig, setLogoConfig] = useState({
    url: INITIAL_LOGOS[0],
    shape: SHAPE_COLLECTION[0],
    bg: BG_COLLECTION[0],
    rotation: 'rotate-0'
  });

  const getRandomConfig = useCallback((url: string) => ({
    url,
    shape: SHAPE_COLLECTION[Math.floor(Math.random() * SHAPE_COLLECTION.length)],
    bg: BG_COLLECTION[Math.floor(Math.random() * BG_COLLECTION.length)],
    rotation: Math.random() > 0.5 ? (Math.random() > 0.5 ? 'rotate-3' : '-rotate-2') : 'rotate-0'
  }), []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setTimeout(() => {
          const newLogos = [base64, ...customLogos];
          setCustomLogos(newLogos);
          localStorage.setItem(LOGO_UPLOAD_KEY, JSON.stringify(newLogos));
          setLogoConfig(getRandomConfig(base64));
          setIsUploading(false);
        }, 800);
      };
      reader.readAsDataURL(file);
    }
  };

  const mapProfile = useCallback((data: any): UserProfile => ({
    id: data.id,
    nickname: data.nickname || '无名氏',
    wechatId: data.wechat_id || '',
    role: data.role as UserRole,
    status: data.status || '',
    locationName: data.location_name || '', 
    lastActive: data.last_active,
    avatar: data.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.id}`,
    isVisible: data.is_visible ?? true,
    lastLat: data.last_lat,
    lastLng: data.last_lng
  }), []);

  const fetchMessages = useCallback(async () => {
    if (!me) return;
    const { data, error } = await supabase
      .from('meetup_requests')
      .select('*, from_profile:profiles!from_user_id(*), to_profile:profiles!to_user_id(*)')
      .or(`from_user_id.eq.${me.id},to_user_id.eq.${me.id}`)
      .order('created_at', { ascending: false });
    if (data && !error) setRequests(data);
  }, [me]);

  const updateRequestStatus = async (requestId: string, status: 'accepted' | 'rejected') => {
    const { error } = await supabase.from('meetup_requests').update({ status }).eq('id', requestId);
    if (!error) {
      await fetchMessages();
      if (selectedRequest?.id === requestId) {
        const updated = requests.find(r => r.id === requestId);
        if (updated) setSelectedRequest({...updated, status});
      }
      if (status === 'accepted') alert('❤️ 已接受邀请！');
      else setSelectedRequest(null);
    }
  };

  // 删除约见记录功能
  const deleteRequest = async (e: React.MouseEvent, requestId: string) => {
    e.stopPropagation(); // 阻止触发卡片点击详情
    if (!confirm('确定要删除这条约见记录吗？删除后不可恢复。')) return;
    
    setIsDeleting(requestId);
    try {
      const { error } = await supabase.from('meetup_requests').delete().eq('id', requestId);
      if (!error) {
        setRequests(prev => prev.filter(r => r.id !== requestId));
        if (selectedRequest?.id === requestId) setSelectedRequest(null);
      } else {
        alert('删除失败，请稍后重试');
      }
    } finally {
      setIsDeleting(null);
    }
  };

  // 隐藏发现页伙伴功能
  const ignoreNearbyUser = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    if (!confirm('确定要隐藏这位伙伴吗？(仅当前可见列表隐藏)')) return;
    const newList = [...ignoredUserIds, userId];
    setIgnoredUserIds(newList);
    localStorage.setItem(IGNORED_USERS_KEY, JSON.stringify(newList));
  };

  const handleCopyAndOpenWechat = (wechatId: string) => {
    navigator.clipboard.writeText(wechatId).then(() => {
      alert('微信号已复制！正在为您打开微信...');
      window.location.href = 'weixin://';
    });
  };

  const fetchNearby = useCallback(async () => {
    if (!me) return;
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_visible', true)
        .order('last_active', { ascending: false });
      if (data && !error) setNearbyUsers(data.map(mapProfile));
    } finally {
      setIsRefreshing(false);
    }
  }, [me, mapProfile]);

  const handleRequest = useCallback(async (target: UserProfile) => {
    if (!me || isSendingRequest) return;
    setIsSendingRequest(true);
    try {
      const { error } = await supabase.from('meetup_requests').insert({
        from_user_id: me.id,
        to_user_id: target.id,
        status: 'pending',
        message: iceBreakerMsg,
        created_at: new Date().toISOString()
      });
      if (!error) {
        setShowMeetupModal(null);
        await fetchMessages();
        setView('messages');
      }
    } finally {
      setIsSendingRequest(false);
    }
  }, [me, iceBreakerMsg, isSendingRequest, fetchMessages]);

  const handleSetupOrUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    const payload: any = {
      nickname: formData.get('nickname') as string,
      wechat_id: formData.get('wechatId') as string,
      role: formData.get('role') as UserRole,
      status: formData.get('status') as string,
      location_name: formData.get('locationName') as string,
      last_active: new Date().toISOString(),
      avatar: me?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.get('nickname')}`,
      is_visible: me ? me.isVisible : true
    };
    if (location) { payload.last_lat = location.lat; payload.last_lng = location.lng; }
    try {
      const query = me?.id ? supabase.from('profiles').update(payload).eq('id', me.id) : supabase.from('profiles').insert(payload);
      const { data, error } = await query.select().single();
      if (data && !error) { setMe(mapProfile(data)); localStorage.setItem(STORAGE_KEY, data.id); setView('home'); }
    } finally { setIsSaving(false); }
  };

  const getGeoLocation = useCallback(async () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setIsLocating(false); },
      () => setIsLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    const initApp = async () => {
      const storedLogos = localStorage.getItem(LOGO_UPLOAD_KEY);
      setCustomLogos(storedLogos ? JSON.parse(storedLogos) : []);
      
      const storedIgnored = localStorage.getItem(IGNORED_USERS_KEY);
      setIgnoredUserIds(storedIgnored ? JSON.parse(storedIgnored) : []);

      const savedUserId = localStorage.getItem(STORAGE_KEY);
      if (savedUserId) {
        const { data } = await supabase.from('profiles').select('*').eq('id', savedUserId).maybeSingle();
        if (data) setMe(mapProfile(data)); else setView('setup');
      } else setView('setup');
      const quote = await getDailyEncouragement();
      setEncouragement(quote || '每一个坚持的瞬间，都是生命的奇迹。');
      setIsInitialized(true);
    };
    initApp();
  }, [mapProfile]);

  useEffect(() => {
    if (view === 'nearby' && me) fetchNearby();
    if (view === 'messages' && me) fetchMessages();
  }, [view, me?.id, fetchNearby, fetchMessages]);

  const filteredNearbyUsers = useMemo(() => {
    return nearbyUsers.filter(u => !ignoredUserIds.includes(u.id));
  }, [nearbyUsers, ignoredUserIds]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-10 text-center">
        <WarmLogo size="w-32 h-32" config={logoConfig} className="mb-8 animate-bounce" />
        <p className="text-brand font-black tracking-widest text-sm uppercase">Warm Connect Loading</p>
      </div>
    );
  }

  // 设置页
  if (view === 'setup' || view === 'edit-profile') {
    const isEdit = view === 'edit-profile';
    return (
      <div className="min-h-screen bg-white p-6 pb-20 flex flex-col max-w-md mx-auto">
        <header className="flex items-center justify-between mb-8">
          {isEdit ? <button onClick={() => setView('profile')} className="p-2 -ml-2 text-slate-400"><ChevronLeft className="w-8 h-8" /></button> : <div className="w-10" />}
          <div className="flex flex-col items-center">
             <WarmLogo size="w-24 h-24" config={logoConfig} className="mb-4" />
             <h1 className="text-xl font-black text-slate-800 tracking-tight">{isEdit ? '编辑我的资料' : '建立我的暖心名片'}</h1>
          </div>
          <div className="w-10" />
        </header>
        <form onSubmit={handleSetupOrUpdate} className="space-y-6">
          <div className="bg-brand-light p-6 rounded-[35px] space-y-4 border border-brand/10">
            <input name="nickname" required defaultValue={me?.nickname} placeholder="昵称 (如: 老王)" className="w-full p-4 rounded-2xl bg-white border-none shadow-sm text-lg outline-none" />
            <select name="role" defaultValue={me?.role || UserRole.PATIENT} className="w-full p-4 rounded-2xl bg-white border-none shadow-sm text-lg outline-none appearance-none">
              <option value={UserRole.PATIENT}>我是患者</option>
              <option value={UserRole.CAREGIVER}>我是家属</option>
            </select>
          </div>
          <div className="bg-slate-50 p-6 rounded-[35px] space-y-4 border border-slate-100">
            <input name="status" defaultValue={me?.status} placeholder="状态 (如: 休息中)" className="w-full p-4 rounded-2xl bg-white border-none shadow-sm text-lg outline-none" />
            <input name="locationName" defaultValue={me?.locationName} placeholder="位置 (如: A座3层)" className="w-full p-4 rounded-2xl bg-white border-none shadow-sm text-lg outline-none" />
            <button type="button" onClick={getGeoLocation} className="flex items-center space-x-2 text-brand font-black text-sm px-4 py-2 bg-white rounded-xl shadow-sm active:scale-95 transition-transform">
              <LocateFixed className={`w-4 h-4 ${isLocating ? 'animate-pulse' : ''}`} />
              <span>{isLocating ? '获取中...' : '校准精确位置'}</span>
            </button>
          </div>
          <div className="px-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">微信号 (必填，仅对方接受后可见)</label>
            <input name="wechatId" required defaultValue={me?.wechatId} placeholder="输入微信号" className="w-full p-4 bg-slate-100 rounded-2xl text-lg outline-none mt-1" />
          </div>
          <button type="submit" disabled={isSaving} className="w-full py-6 bg-brand text-white rounded-[32px] font-black text-xl shadow-xl active:scale-95 transition-transform disabled:bg-slate-200">
            {isSaving ? <RefreshCcw className="animate-spin w-6 h-6 mx-auto" /> : '开启暖遇之旅'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col relative pb-32">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-slate-100 shadow-sm">
        <div onClick={() => setView('home')} className="flex items-center space-x-3 cursor-pointer group">
          <WarmLogo size="w-11 h-11" config={logoConfig} className="group-active:scale-90" />
          <h1 className="text-2xl font-black text-brand tracking-tighter leading-none">暖遇</h1>
        </div>
        <button onClick={() => setView('profile')} className="w-11 h-11 rounded-2xl border-2 border-brand-light overflow-hidden shadow-sm bg-white active:scale-90 transition-transform">
          <img src={me?.avatar} alt="avatar" className="w-full h-full object-cover" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto">
        {view === 'home' && (
          <div className="p-6 space-y-6">
            <div className="bg-gradient-to-br from-brand to-brand-dark p-8 rounded-[40px] text-white shadow-xl relative overflow-hidden">
              <Heart className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10 rotate-12" />
              <div className="relative z-10">
                <span className="text-[10px] font-black opacity-70 tracking-widest uppercase">今日暖语</span>
                <h2 className="text-2xl font-bold mt-2 leading-tight drop-shadow-sm">{encouragement}</h2>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <button onClick={() => setView('nearby')} className="w-full p-8 bg-white rounded-[40px] border border-slate-100 shadow-sm text-left active:scale-[0.98] transition-all group">
                <div className="bg-brand-light p-3 rounded-xl w-fit text-brand mb-4 group-hover:scale-110 transition-transform"><Heart className="w-7 h-7 fill-current" /></div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">搜寻周围伙伴</h3>
                <p className="text-slate-400 text-sm font-bold mt-1">发现同在医院或附近的伴侣</p>
              </button>
              <button onClick={() => setView('messages')} className="w-full p-8 bg-white rounded-[40px] border border-slate-100 shadow-sm text-left active:scale-[0.98] transition-all relative group">
                <div className="bg-accent-light p-3 rounded-xl w-fit text-accent mb-4 group-hover:scale-110 transition-transform"><Bell className="w-7 h-7 fill-current" /></div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">约见状态箱</h3>
                <p className="text-slate-400 text-sm font-bold mt-1">管理你的互助邀请与反馈</p>
                {requests.some(r => r.to_user_id === me?.id && r.status === 'pending') && (
                  <div className="absolute top-8 right-8 w-4 h-4 bg-accent rounded-full border-2 border-white animate-bounce" />
                )}
              </button>
            </div>
          </div>
        )}

        {view === 'nearby' && (
          <div className="p-6 space-y-5">
            <h2 className="text-2xl font-black text-slate-800 px-2">附近的伙伴</h2>
            {filteredNearbyUsers.length === 0 ? (
              <div className="py-24 text-center text-slate-300 font-bold">周围暂时没有伙伴</div>
            ) : (
              filteredNearbyUsers.map(user => (
                <div key={user.id} className="bg-white p-6 rounded-[35px] border border-slate-100 mb-4 shadow-sm relative group">
                  {/* 发现页删除/隐藏按钮 */}
                  <button 
                    onClick={(e) => ignoreNearbyUser(e, user.id)}
                    className="absolute top-6 right-6 p-2 text-slate-300 hover:text-accent transition-all active:scale-90"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  
                  <div className="flex items-start space-x-4 mb-6 pr-8">
                    <img src={user.avatar} className="w-16 h-16 rounded-2xl shrink-0 object-cover border border-white" />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-black text-lg text-slate-800">{user.nickname} {user.id === me?.id && '(我)'}</span>
                      </div>
                      <div className="mt-2 text-brand font-bold text-sm flex items-center"><MapPin className="w-3.5 h-3.5 mr-1" />{user.locationName}</div>
                    </div>
                  </div>
                  <button onClick={async () => { setShowMeetupModal(user); const msg = await getIceBreaker(me?.role || '伙伴', user.role, user.status); setIceBreakerMsg(msg); }} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center space-x-2 active:scale-95 transition-transform">
                    <Send className="w-5 h-5" /><span>{user.id === me?.id ? '记下暖心瞬间' : '发起暖心约见'}</span>
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {view === 'messages' && (
          <div className="p-6 space-y-5">
            <h2 className="text-2xl font-black text-slate-800 px-2">约见通知</h2>
            {requests.length === 0 ? (
              <div className="py-24 text-center text-slate-300 font-bold">暂时还没有消息</div>
            ) : requests.map(req => {
              const other = req.from_user_id === me?.id ? req.to_profile : req.from_profile;
              return (
                <div 
                  key={req.id} 
                  onClick={() => setSelectedRequest(req)}
                  className={`bg-white p-6 rounded-[35px] border border-slate-100 shadow-sm mb-4 active:scale-[0.98] transition-all flex items-center justify-between cursor-pointer group relative ${req.status === 'accepted' ? 'bg-brand-light/20' : ''} ${isDeleting === req.id ? 'opacity-50 grayscale' : ''}`}
                >
                  <div className="flex items-center space-x-4">
                    <img src={other?.avatar} className="w-12 h-12 rounded-xl" />
                    <div>
                      <h4 className="font-black text-slate-800">{other?.nickname}</h4>
                      <p className="text-slate-400 text-xs truncate max-w-[150px]">{req.message}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex flex-col items-end">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${req.status === 'pending' ? 'text-accent border-accent/20' : req.status === 'accepted' ? 'text-brand border-brand/20' : 'text-slate-300 border-slate-100'}`}>
                        {req.status === 'pending' ? '待处理' : req.status === 'accepted' ? '已接受' : '已拒绝'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-200 mt-1" />
                    </div>
                    {/* 删除按钮 */}
                    <button 
                      onClick={(e) => deleteRequest(e, req.id)}
                      className="p-2 text-slate-300 hover:text-accent transition-colors md:opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {view === 'profile' && me && (
          <div className="p-6 space-y-6">
            <div className="bg-white p-8 rounded-[40px] text-center border border-slate-100 shadow-sm">
               <div className="w-20 h-20 mx-auto rounded-[28px] overflow-hidden shadow-lg mb-4 bg-brand-light">
                 <img src={me.avatar} className="w-full h-full object-cover" />
               </div>
               <h3 className="text-2xl font-black text-slate-800">{me.nickname}</h3>
               <p className="text-brand font-black text-xs uppercase mt-1 tracking-widest">{me.role}</p>
            </div>
            
            <div className="bg-white rounded-[35px] overflow-hidden border border-slate-100 shadow-sm">
              <button onClick={() => setView('edit-profile')} className="w-full p-6 flex items-center justify-between border-b border-slate-50 active:bg-slate-50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-brand-light rounded-xl text-brand"><User className="w-5 h-5" /></div>
                  <span className="font-black text-slate-700">修改我的资料</span>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300" />
              </button>
            </div>
            <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full py-5 text-accent font-black text-lg bg-accent-light/50 rounded-[28px]">安全登出</button>
          </div>
        )}
      </main>

      {/* 约见详情详情弹窗 - 闭环核心 */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full rounded-[45px] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300 flex flex-col max-h-[85vh]">
            <div className="p-8 pb-4 flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800">约见详情</h3>
              <button onClick={() => setSelectedRequest(null)} className="p-2 bg-slate-50 rounded-full text-slate-400"><XCircle className="w-6 h-6" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 pt-0 space-y-6">
              {/* 对方信息 */}
              <div className="flex items-center space-x-4 bg-slate-50 p-5 rounded-[30px]">
                <img src={(selectedRequest.from_user_id === me?.id ? selectedRequest.to_profile : selectedRequest.from_profile)?.avatar} className="w-16 h-16 rounded-2xl shadow-sm" />
                <div>
                  <div className="text-lg font-black text-slate-800">{(selectedRequest.from_user_id === me?.id ? selectedRequest.to_profile : selectedRequest.from_profile)?.nickname}</div>
                  <div className="text-xs font-bold text-slate-400">对方现在的状态：{(selectedRequest.from_user_id === me?.id ? selectedRequest.to_profile : selectedRequest.from_profile)?.status || '正在同行'}</div>
                </div>
              </div>

              {/* 消息正文 */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">暖心话语</label>
                <div className="bg-brand-light/40 p-6 rounded-[30px] text-slate-700 italic font-medium leading-relaxed">
                  "{selectedRequest.message}"
                </div>
              </div>

              {/* 处理逻辑 */}
              {selectedRequest.status === 'pending' && selectedRequest.to_user_id === me?.id ? (
                <div className="space-y-4 pt-4">
                  <button 
                    onClick={() => updateRequestStatus(selectedRequest.id, 'accepted')} 
                    className="w-full py-6 bg-brand text-white rounded-[30px] font-black text-xl shadow-xl active:scale-95 transition-transform"
                  >
                    确认接受
                  </button>
                  <button 
                    onClick={() => updateRequestStatus(selectedRequest.id, 'rejected')} 
                    className="w-full py-5 bg-slate-100 text-slate-400 rounded-[30px] font-black text-lg active:bg-slate-200"
                  >
                    我再想想
                  </button>
                </div>
              ) : selectedRequest.status === 'accepted' ? (
                <div className="space-y-4 pt-4">
                  <div className="text-center">
                    <div className="bg-emerald-50 text-emerald-600 inline-flex p-3 rounded-full mb-3"><Heart className="w-6 h-6 fill-current" /></div>
                    <h4 className="text-xl font-black text-slate-800">约见已生效</h4>
                    <p className="text-slate-400 text-sm font-bold">温暖正在路上，请联系对方：</p>
                  </div>
                  
                  <div className="bg-slate-900 text-white p-6 rounded-[35px] relative group overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand/10 -mr-10 -mt-10 rounded-full blur-2xl" />
                    <div className="relative flex flex-col items-center">
                       <span className="text-[10px] font-black uppercase opacity-50 tracking-[0.2em] mb-2">对方微信号</span>
                       <div className="text-3xl font-black tracking-widest">{(selectedRequest.from_user_id === me?.id ? selectedRequest.to_profile : selectedRequest.from_profile)?.wechat_id}</div>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleCopyAndOpenWechat((selectedRequest.from_user_id === me?.id ? selectedRequest.to_profile : selectedRequest.from_profile)?.wechat_id)}
                    className="w-full py-6 bg-brand text-white rounded-[32px] font-black text-xl shadow-xl flex items-center justify-center space-x-3 active:scale-95 transition-transform"
                  >
                    <MessageSquare className="w-6 h-6" />
                    <span>复制并打开微信</span>
                  </button>
                </div>
              ) : (
                <div className="text-center py-10">
                  <p className="text-slate-300 font-bold">该约见已结束</p>
                </div>
              )}

              {/* 详情页删除入口 */}
              <div className="pt-4 pb-4">
                <button 
                  onClick={(e) => deleteRequest(e, selectedRequest.id)}
                  className="w-full py-4 text-slate-400 font-bold text-sm flex items-center justify-center space-x-2 border border-dashed border-slate-200 rounded-[25px] active:bg-slate-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>删除这条往来记录</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur-xl border-t border-slate-100 px-10 pt-4 pb-12 flex justify-between items-center z-40">
        {[
          { id: 'home', label: '首页' },
          { id: 'nearby', label: '发现' },
          { id: 'messages', label: '通知' },
          { id: 'profile', label: '我的' }
        ].map(item => (
          <button key={item.id} onClick={() => setView(item.id as any)} className={`flex flex-col items-center transition-all ${view === item.id ? 'text-brand' : 'text-slate-400'}`}>
            <span className={`text-[15px] font-black uppercase tracking-widest ${view === item.id ? 'scale-110' : 'opacity-80'}`}>{item.label}</span>
            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 transition-all ${view === item.id ? 'bg-brand' : 'bg-transparent'}`} />
          </button>
        ))}
      </nav>

      {showMeetupModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-[50px] p-10 pb-12 shadow-2xl space-y-8 animate-in slide-in-from-bottom duration-300 overflow-hidden">
            <div className="text-center relative">
              <div className="w-24 h-24 rounded-[30px] mx-auto mb-4 border-4 border-brand-light overflow-hidden bg-slate-50 p-2 flex items-center justify-center">
                 <img src={showMeetupModal.avatar} className="w-full h-full object-contain" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-tight">
                {showMeetupModal.id === me?.id ? '给自己记一笔' : '发送暖心约见'}
              </h3>
            </div>
            <div className="bg-brand-light p-7 rounded-[35px] text-brand-dark italic font-medium text-center">"{iceBreakerMsg || '正在思索温暖的话语...'}"</div>
            <div className="space-y-4">
              <button onClick={() => handleRequest(showMeetupModal)} disabled={isSendingRequest} className="w-full py-6 bg-brand text-white rounded-[32px] font-black text-xl shadow-xl">
                {isSendingRequest ? <RefreshCcw className="animate-spin w-6 h-6 mx-auto" /> : '确认发出'}
              </button>
              <button onClick={() => setShowMeetupModal(null)} className="w-full py-6 bg-slate-50 text-slate-400 rounded-[32px] font-black text-xl">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
