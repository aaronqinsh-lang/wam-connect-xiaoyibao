
import React, { useState, useEffect, useCallback } from 'react';
import { 
  MapPin, 
  Heart, 
  RefreshCcw,
  ChevronRight,
  User,
  LocateFixed,
  XCircle,
  Send,
  Trash2,
  MessageSquare,
  Check,
  RotateCcw,
  Smile,
  LogOut,
  PartyPopper,
  Bell,
  Loader2
} from 'lucide-react';
import { UserProfile, UserRole, LocationState } from './types';
import { getDailyEncouragement, getIceBreaker } from './services/geminiService';
import { supabase } from './lib/supabase';

const STORAGE_KEY = 'warm_connect_user_id';

/**
 * 治愈系卡通 Logo 组件
 */
const WarmLogo: React.FC<{ size: string, seed?: string, className?: string, onClick?: () => void }> = ({ size, seed = "Warm", className = "", onClick }) => {
  return (
    <div 
      onClick={onClick}
      className={`${size} rounded-[35%] bg-gradient-to-br from-brand-light to-brand/20 p-2 flex items-center justify-center shadow-lg border-2 border-white transition-all duration-500 hover:rotate-3 active:scale-90 cursor-pointer ${className}`}
    >
      <img 
        src={`https://api.dicebear.com/7.x/big-smile/svg?seed=${seed}&backgroundColor=transparent`} 
        alt="Mascot" 
        className="w-full h-full object-contain"
      />
    </div>
  );
};

/**
 * 状态指示器辅助
 */
const getStatusColor = (lastActive: string) => {
  if (!lastActive) return 'bg-slate-400';
  const last = new Date(lastActive).getTime();
  const now = Date.now();
  const diffMinutes = (now - last) / (1000 * 60);
  if (diffMinutes <= 5) return 'bg-green-500'; 
  if (diffMinutes <= 60) return 'bg-orange-500';
  return 'bg-slate-400';
};

/**
 * 全局提示
 */
const Toast: React.FC<{ message: string; isVisible: boolean }> = ({ message, isVisible }) => (
  <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 transform ${isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-10 opacity-0 scale-90 pointer-events-none'}`}>
    <div className="bg-slate-900/90 backdrop-blur-xl text-white px-6 py-3 rounded-full shadow-2xl flex items-center space-x-2 border border-white/10">
      <Check className="w-4 h-4 text-brand" />
      <span className="text-sm font-black whitespace-nowrap">{message}</span>
    </div>
  </div>
);

const App: React.FC = () => {
  const [view, setView] = useState<'home' | 'nearby' | 'messages' | 'profile' | 'setup' | 'edit-profile'>('home');
  const [me, setMe] = useState<UserProfile | null>(null);
  const [nearbyUsers, setNearbyUsers] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [location, setLocation] = useState<LocationState | null>(null);
  const [encouragement, setEncouragement] = useState<string>('生命因互助而温暖。');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showMeetupModal, setShowMeetupModal] = useState<UserProfile | null>(null);
  const [iceBreakerMsg, setIceBreakerMsg] = useState('');
  const [isGeneratingMsg, setIsGeneratingMsg] = useState(false);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const mapProfile = useCallback((data: any): UserProfile => ({
    id: data.id,
    nickname: data.nickname || '新伙伴',
    wechatId: data.wechat_id || '',
    role: data.role as UserRole,
    status: data.status || '正在前行',
    locationName: data.location_name || '未知区域', 
    lastActive: data.last_active,
    avatar: data.avatar || `https://api.dicebear.com/7.x/big-smile/svg?seed=${data.id}&backgroundColor=b6e3f4`,
    isVisible: data.is_visible ?? true,
    lastLat: data.last_lat,
    lastLng: data.last_lng
  }), []);

  const fetchNearby = useCallback(async () => {
    if (!me) return;
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_visible', true)
        .order('last_active', { ascending: false });
      if (data && !error) {
        setNearbyUsers(data.map(mapProfile));
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [me, mapProfile]);

  const fetchMessages = useCallback(async () => {
    if (!me) return;
    const { data, error } = await supabase
      .from('meetup_requests')
      .select('*, from_profile:profiles!from_user_id(*), to_profile:profiles!to_user_id(*)')
      .or(`from_user_id.eq.${me.id},to_user_id.eq.${me.id}`)
      .order('created_at', { ascending: false });
    if (data && !error) setRequests(data);
  }, [me]);

  // --- 处理函数 ---

  // 物理删除用户记录
  const handleDeleteNearbyUser = async (e: React.MouseEvent, userId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (userId === me?.id) {
      triggerToast('不能删除自己');
      return;
    }
    
    if (!window.confirm('确定要从系统中物理删除这位伙伴的资料吗？（此操作不可撤销）')) {
      return;
    }

    setIsDeleting(userId);
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (!error) {
        setNearbyUsers(prev => prev.filter(u => u.id !== userId));
        triggerToast('记录已永久移除');
      } else {
        triggerToast('删除失败: ' + error.message);
      }
    } catch (err) {
      triggerToast('系统异常');
    } finally {
      setIsDeleting(null);
    }
  };

  // 发起约见点击
  const handleOpenMeetup = async (e: React.MouseEvent, user: UserProfile) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!me) {
      setView('setup');
      return;
    }

    setShowMeetupModal(user);
    setIceBreakerMsg('');
    setIsGeneratingMsg(true);
    
    try {
      const msg = await getIceBreaker(me.role || '伙伴', user.role, user.status);
      setIceBreakerMsg(msg);
    } catch (err) {
      setIceBreakerMsg('你好，看到你也在附近，方便聊聊吗？');
    } finally {
      setIsGeneratingMsg(false);
    }
  };

  const handleSendMeetupRequest = async () => {
    if (!me || !showMeetupModal || isSendingRequest) return;
    setIsSendingRequest(true);
    try {
      const { error } = await supabase.from('meetup_requests').insert({
        from_user_id: me.id,
        to_user_id: showMeetupModal.id,
        status: 'pending',
        message: iceBreakerMsg,
        created_at: new Date().toISOString()
      });
      if (!error) {
        setShowMeetupModal(null);
        triggerToast('邀请已发出');
        fetchMessages();
        setView('messages');
      }
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm('确定要安全登出吗？')) {
      localStorage.removeItem(STORAGE_KEY);
      setMe(null);
      setNearbyUsers([]);
      setRequests([]);
      setView('home');
      triggerToast('已安全退出');
    }
  };

  const updateRequestStatus = async (requestId: string, status: 'accepted' | 'rejected') => {
    if (isProcessingAction) return;
    setIsProcessingAction(true);
    try {
      const { error } = await supabase.from('meetup_requests').update({ status }).eq('id', requestId);
      if (!error) {
        fetchMessages();
        if (selectedRequest?.id === requestId) {
          setSelectedRequest((prev: any) => ({ ...prev, status }));
        }
        triggerToast(status === 'accepted' ? '连结成功！' : '已婉拒');
      }
    } finally {
      setIsProcessingAction(false);
    }
  };

  const deleteRequest = async (e: React.MouseEvent, requestId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDeleting(requestId);
    try {
      const { error } = await supabase.from('meetup_requests').delete().eq('id', requestId);
      if (!error) {
        setRequests(prev => prev.filter(r => r.id !== requestId));
        if (selectedRequest?.id === requestId) setSelectedRequest(null);
        triggerToast('记录已移除');
      }
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSetupOrUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    const nickname = formData.get('nickname') as string;
    const payload: any = {
      nickname,
      wechat_id: formData.get('wechatId') as string,
      role: formData.get('role') as UserRole,
      status: formData.get('status') as string,
      location_name: formData.get('locationName') as string,
      last_active: new Date().toISOString(),
      avatar: `https://api.dicebear.com/7.x/big-smile/svg?seed=${nickname + Date.now()}&backgroundColor=b6e3f4`,
      is_visible: true
    };
    if (location) { payload.last_lat = location.lat; payload.last_lng = location.lng; }
    try {
      const query = me?.id ? supabase.from('profiles').update(payload).eq('id', me.id) : supabase.from('profiles').insert(payload);
      const { data, error } = await query.select().single();
      if (data && !error) { 
        setMe(mapProfile(data)); 
        localStorage.setItem(STORAGE_KEY, data.id); 
        setView('home'); 
        triggerToast('名片已同步'); 
      }
    } finally { setIsSaving(false); }
  };

  const getGeoLocation = useCallback(async () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { 
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); 
        setIsLocating(false); 
        triggerToast('定位成功'); 
      },
      () => { setIsLocating(false); triggerToast('定位失败'); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    const initApp = async () => {
      const savedUserId = localStorage.getItem(STORAGE_KEY);
      if (savedUserId) {
        try {
          const { data, error } = await supabase.from('profiles').select('*').eq('id', savedUserId).maybeSingle();
          if (data && !error) setMe(mapProfile(data));
        } catch(e) {}
      }
      try {
        const quote = await getDailyEncouragement();
        setEncouragement(quote || '生命因互助而温暖。');
      } catch(e) {}
      setIsInitialized(true);
    };
    initApp();
  }, [mapProfile]);

  useEffect(() => {
    if (view === 'nearby' && me) fetchNearby();
    if (view === 'messages' && me) fetchMessages();
  }, [view, me?.id, fetchNearby, fetchMessages]);

  if (!isInitialized) return (
    <div className="min-h-screen bg-brand-light/30 flex items-center justify-center">
      <WarmLogo size="w-32 h-32" className="animate-bounce" />
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#FDFDFD] flex flex-col relative pb-24 overflow-x-hidden">
      <Toast message={toastMsg} isVisible={showToast} />

      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-2xl px-6 py-4 flex items-center justify-between border-b border-slate-100">
        <div onClick={() => setView('home')} className="flex items-center space-x-2 cursor-pointer btn-active">
          <WarmLogo size="w-10 h-10" />
          <h1 className="text-xl font-black text-slate-800 tracking-tighter">暖遇</h1>
        </div>
        {me ? (
          <button type="button" onClick={() => setView('profile')} className="w-11 h-11 rounded-2xl border-2 border-brand-light p-0.5 shadow-sm active:scale-90 transition-transform bg-white overflow-hidden cursor-pointer">
            <img src={me.avatar} className="w-full h-full object-cover" alt="Profile" />
          </button>
        ) : (
          <button type="button" onClick={() => setView('setup')} className="bg-brand-light text-brand font-black text-xs px-4 py-2 rounded-xl active:scale-95 transition-all cursor-pointer">注册/登录</button>
        )}
      </header>

      <main className="flex-1 overflow-y-auto">
        {view === 'home' && (
          <div className="p-6 space-y-6">
            <div className="bg-gradient-to-br from-brand to-brand-dark p-8 rounded-[40px] text-white shadow-xl relative overflow-hidden">
              <Smile className="absolute -right-6 -bottom-6 w-32 h-32 text-white/10 rotate-12" />
              <div className="relative z-10">
                <span className="text-[10px] font-black tracking-widest uppercase opacity-70">Daily Encouragement</span>
                <h2 className="text-xl font-bold mt-2 leading-tight italic">“{encouragement}”</h2>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <button type="button" onClick={() => me ? setView('nearby') : setView('setup')} className="w-full p-8 bg-white rounded-[40px] shadow-sm border border-slate-100 text-left active:scale-[0.98] transition-all group cursor-pointer">
                <div className="bg-brand-light p-3 rounded-xl w-fit text-brand mb-4 shadow-inner"><Heart className="w-7 h-7 fill-current" /></div>
                <h3 className="text-xl font-black text-slate-800">搜寻伙伴</h3>
                <p className="text-slate-400 text-xs font-bold mt-1">发现周围志同道合的人</p>
              </button>
              
              <button type="button" onClick={() => me ? setView('messages') : setView('setup')} className="w-full p-8 bg-white rounded-[40px] shadow-sm border border-slate-100 text-left active:scale-[0.98] transition-all relative cursor-pointer">
                <div className="bg-accent-light p-3 rounded-xl w-fit text-accent mb-4 shadow-inner"><Bell className="w-7 h-7 fill-current" /></div>
                <h3 className="text-xl font-black text-slate-800">约见通知</h3>
                <p className="text-slate-400 text-xs font-bold mt-1">管理你的互动与连结</p>
                {me && requests.some(r => r.to_user_id === me?.id && r.status === 'pending') && (
                  <div className="absolute top-8 right-8 w-3 h-3 bg-accent rounded-full border-2 border-white animate-pulse" />
                )}
              </button>
            </div>
          </div>
        )}

        {view === 'nearby' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xl font-black text-slate-800">附近的伙伴</h2>
              <button type="button" onClick={fetchNearby} className="p-2 text-slate-300 hover:text-brand transition-colors cursor-pointer">
                <RotateCcw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {nearbyUsers.length === 0 ? (
              <div className="py-20 text-center text-slate-300 font-bold">暂无伙伴在线</div>
            ) : nearbyUsers.map(user => (
              <div 
                key={user.id} 
                className={`bg-white p-7 rounded-[35px] shadow-sm border border-slate-100 mb-4 relative ${isDeleting === user.id ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {user.id !== me?.id && (
                  <button 
                    type="button"
                    onClick={(e) => handleDeleteNearbyUser(e, user.id)} 
                    className="absolute top-5 right-5 p-3 text-slate-200 hover:text-accent active:scale-75 transition-all z-30 cursor-pointer"
                    title="彻底删除此记录"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                
                <div className="flex items-center space-x-4 mb-6">
                  <div className="relative shrink-0">
                    <div className="w-16 h-16 rounded-2xl border-2 border-slate-50 overflow-hidden bg-brand-light/20">
                      <img src={user.avatar} className="w-full h-full object-cover" alt={user.nickname} />
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow-sm ${getStatusColor(user.lastActive)}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-black text-lg text-slate-800 truncate block">{user.nickname}{user.id === me?.id ? ' (我)' : ''}</span>
                    <div className="flex items-center text-brand font-bold text-[10px] mt-0.5 truncate">
                      <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                      <span className="truncate">{user.locationName}</span>
                    </div>
                  </div>
                </div>
                
                <button 
                  type="button"
                  onClick={(e) => handleOpenMeetup(e, user)} 
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm flex items-center justify-center space-x-2 active:scale-[0.97] transition-all shadow-lg shadow-slate-200 cursor-pointer relative z-20"
                >
                  <Send className="w-4 h-4" />
                  <span>发起约见</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {view === 'messages' && (
          <div className="p-6 space-y-3">
            <h2 className="text-xl font-black text-slate-800 px-2">消息中心</h2>
            {requests.length === 0 ? (
              <div className="py-20 text-center text-slate-300 font-bold">暂无动态</div>
            ) : requests.map(req => {
              const other = req.from_user_id === me?.id ? req.to_profile : req.from_profile;
              return (
                <div 
                  key={req.id} 
                  onClick={() => setSelectedRequest(req)}
                  className={`bg-white p-5 rounded-[30px] shadow-sm border border-slate-100 mb-2 active:scale-[0.98] transition-all flex items-center justify-between cursor-pointer relative overflow-hidden ${isDeleting === req.id ? 'opacity-50' : ''}`}
                >
                  {req.status === 'accepted' && <div className="absolute top-0 left-0 bottom-0 w-1 bg-brand" />}
                  <div className="flex items-center space-x-4 min-w-0">
                    <div className="relative shrink-0">
                      <img src={other?.avatar} className="w-12 h-12 rounded-xl shrink-0 border border-slate-50 object-cover" alt={other?.nickname} />
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-white ${getStatusColor(other?.last_active)}`} />
                    </div>
                    <div className="truncate">
                      <h4 className="font-black text-slate-800 text-sm">{other?.nickname}</h4>
                      <p className="text-slate-400 text-[10px] italic truncate">“{req.message}”</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 shrink-0 ml-2">
                    <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full ${req.status === 'pending' ? 'bg-accent-light text-accent' : req.status === 'accepted' ? 'bg-brand-light text-brand' : 'bg-slate-50 text-slate-300'}`}>
                      {req.status === 'pending' ? '待定' : req.status === 'accepted' ? '连结' : '已拒'}
                    </span>
                    <button type="button" onClick={(e) => deleteRequest(e, req.id)} className="p-2 text-slate-200 hover:text-accent transition-all cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {view === 'profile' && me && (
          <div className="p-6 space-y-6">
            <div className="bg-white p-8 rounded-[40px] text-center border border-slate-100 shadow-sm">
               <div className="relative w-24 h-24 mx-auto mb-4">
                 <div className="w-24 h-24 rounded-3xl border-4 border-brand-light p-0.5 shadow-md bg-white overflow-hidden">
                   <img src={me.avatar} className="w-full h-full object-cover" alt="Me" />
                 </div>
                 <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full border-4 border-white bg-green-500" />
               </div>
               <h3 className="text-2xl font-black text-slate-800">{me.nickname}</h3>
               <span className="text-brand font-black text-[10px] bg-brand-light px-3 py-1 rounded-full uppercase mt-2 inline-block tracking-widest">{me.role}</span>
            </div>
            <div className="space-y-3">
              <button type="button" onClick={() => setView('edit-profile')} className="w-full p-5 bg-white rounded-[25px] flex items-center justify-between border border-slate-100 shadow-sm active:bg-slate-50 transition-all cursor-pointer">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-brand-light rounded-xl text-brand shadow-inner"><User className="w-5 h-5" /></div>
                  <span className="font-black text-slate-700">编辑名片</span>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-200" />
              </button>
              <button type="button" onClick={handleLogout} className="w-full p-5 bg-white rounded-[25px] flex items-center justify-between border border-slate-100 shadow-sm active:bg-slate-50 transition-all text-accent cursor-pointer">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-accent-light rounded-xl shadow-inner"><LogOut className="w-5 h-5" /></div>
                  <span className="font-black">安全登出</span>
                </div>
                <ChevronRight className="w-5 h-5 opacity-20" />
              </button>
            </div>
          </div>
        )}

        {(view === 'setup' || view === 'edit-profile') && (
          <div className="fixed inset-0 z-[60] bg-[#FDFDFD] p-8 flex flex-col max-w-md mx-auto overflow-y-auto animate-in slide-in-from-right duration-500">
            <header className="flex flex-col items-center mb-8">
              <WarmLogo size="w-28 h-28" className="mb-6" seed={me?.nickname || "New"} />
              <h1 className="text-2xl font-black text-slate-800 tracking-tight text-center">完善你的治愈系名片</h1>
            </header>
            <form onSubmit={handleSetupOrUpdate} className="space-y-6">
              <div className="space-y-3">
                <input name="nickname" required defaultValue={me?.nickname} placeholder="昵称" className="w-full p-4 bg-slate-50 rounded-2xl text-lg font-black text-slate-800 outline-none border border-slate-100" />
                <select name="role" defaultValue={me?.role || UserRole.PATIENT} className="w-full p-4 bg-slate-50 rounded-2xl text-lg font-black text-slate-800 outline-none appearance-none border border-slate-100">
                  <option value={UserRole.PATIENT}>我是患者</option>
                  <option value={UserRole.CAREGIVER}>我是家属</option>
                  <option value={UserRole.VOLUNTEER}>我是志愿者</option>
                </select>
                <input name="status" defaultValue={me?.status} placeholder="当前状态 (如: 正在等候、心情不错)" className="w-full p-5 bg-white rounded-2xl text-base font-bold shadow-sm border border-slate-100 outline-none" />
                <div className="flex items-center space-x-2">
                  <input name="locationName" defaultValue={me?.locationName} placeholder="位置描述 (如: A座3楼)" className="flex-1 p-5 bg-white rounded-2xl text-base font-bold shadow-sm border border-slate-100 outline-none" />
                  <button type="button" onClick={getGeoLocation} className="p-5 bg-brand text-white rounded-2xl shadow-lg active:scale-90 transition-all cursor-pointer"><LocateFixed className={`w-5 h-5 ${isLocating ? 'animate-spin' : ''}`} /></button>
                </div>
                <input name="wechatId" required defaultValue={me?.wechatId} placeholder="微信号 (仅在双方同意后展示)" className="w-full p-5 bg-slate-50 rounded-2xl text-lg font-black outline-none border border-slate-100" />
              </div>
              <div className="pt-2 flex space-x-3">
                {view === 'edit-profile' && <button type="button" onClick={() => setView('profile')} className="w-1/3 py-5 bg-slate-50 text-slate-400 rounded-2xl font-black active:bg-slate-100 cursor-pointer">取消</button>}
                <button type="submit" disabled={isSaving} className="flex-1 py-5 bg-slate-900 text-white rounded-2xl font-black text-xl shadow-xl active:scale-95 transition-all cursor-pointer">
                  {isSaving ? <RefreshCcw className="animate-spin w-6 h-6 mx-auto" /> : '同步资料'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* 破冰邀请模态框 */}
      {showMeetupModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm p-6">
          <div className="bg-white w-full max-w-md rounded-[45px] p-8 shadow-2xl space-y-8 animate-in slide-in-from-bottom duration-500">
            <div className="text-center relative">
              <div className="w-20 h-20 rounded-[25px] mx-auto mb-4 border-2 border-brand-light shadow-md overflow-hidden bg-white">
                 <img src={showMeetupModal.avatar} className="w-full h-full object-cover" alt="Target" />
              </div>
              <h3 className="text-2xl font-black text-slate-800">发起约见</h3>
              <p className="text-slate-400 text-xs font-bold mt-1">给 {showMeetupModal.nickname} 发送一段暖心邀请</p>
            </div>
            <div className="bg-brand-light/40 p-6 rounded-[30px] text-brand-dark italic font-bold text-center border-2 border-white leading-relaxed shadow-inner min-h-[100px] flex items-center justify-center">
              {isGeneratingMsg ? (
                <div className="flex flex-col items-center space-y-2 opacity-50">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-xs">AI 正在酝酿破冰语...</span>
                </div>
              ) : (
                <span className="text-sm">“{iceBreakerMsg}”</span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3">
              <button 
                type="button"
                onClick={handleSendMeetupRequest} 
                disabled={isSendingRequest || isGeneratingMsg} 
                className="w-full py-5 bg-brand text-white rounded-[25px] font-black text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center space-x-3 disabled:opacity-50 cursor-pointer"
              >
                {isSendingRequest ? <RefreshCcw className="animate-spin w-6 h-6" /> : <><Send className="w-6 h-6" /><span>发出邀请</span></>}
              </button>
              <button type="button" onClick={() => setShowMeetupModal(null)} className="w-full py-4 bg-slate-50 text-slate-300 rounded-[25px] font-black active:bg-slate-100 transition-all cursor-pointer">取消</button>
            </div>
          </div>
        </div>
      )}

      {/* 约见详情/通知模态框 */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-xl">
          <div className="bg-white w-full rounded-[45px] overflow-hidden shadow-2xl animate-in zoom-in duration-300 max-h-[80vh] flex flex-col">
            <div className="p-6 pb-2 flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800">约见详情</h3>
              <button type="button" onClick={() => setSelectedRequest(null)} className="p-2 bg-slate-50 rounded-full text-slate-400 active:scale-90 transition-all cursor-pointer"><XCircle className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-6">
              <div className="flex items-center space-x-4 bg-brand-light/20 p-5 rounded-[25px]">
                {(() => {
                  const other = selectedRequest.from_user_id === me?.id ? selectedRequest.to_profile : selectedRequest.from_profile;
                  return (
                    <>
                      <div className="relative shrink-0">
                        <img src={other?.avatar} className="w-16 h-16 rounded-[20px] shadow-sm border-2 border-white object-cover" alt="Other" />
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(other?.last_active)}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xl font-black text-slate-800 truncate">{other?.nickname}</div>
                        <div className="text-brand font-bold text-[10px] mt-0.5">状态：{other?.status}</div>
                      </div>
                    </>
                  );
                })()}
              </div>
              <div className="bg-[#F8FBFA] p-6 rounded-[25px] text-slate-700 italic text-base leading-relaxed border border-brand/5 shadow-inner">
                “{selectedRequest.message}”
              </div>

              {selectedRequest.status === 'pending' ? (
                selectedRequest.to_user_id === me?.id ? (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button type="button" disabled={isProcessingAction} onClick={() => updateRequestStatus(selectedRequest.id, 'accepted')} className="py-5 bg-brand text-white rounded-[25px] font-black shadow-lg active:scale-95 transition-all flex items-center justify-center cursor-pointer">{isProcessingAction ? <RefreshCcw className="animate-spin w-5 h-5" /> : '接受连结'}</button>
                    <button type="button" disabled={isProcessingAction} onClick={() => updateRequestStatus(selectedRequest.id, 'rejected')} className="py-5 bg-slate-100 text-slate-400 rounded-[25px] font-black active:bg-slate-200 transition-all cursor-pointer">婉拒</button>
                  </div>
                ) : (
                  <div className="text-center py-6 bg-slate-50 rounded-[25px] border border-dashed border-slate-200 animate-pulse text-slate-400 font-bold text-sm">等待回应中...</div>
                )
              ) : selectedRequest.status === 'accepted' ? (
                <div className="space-y-4 pt-2">
                  <div className="text-center p-6 bg-brand/5 rounded-[30px] border border-brand/10">
                    <PartyPopper className="w-8 h-8 text-brand mx-auto mb-3" />
                    <p className="text-slate-400 font-bold text-xs mb-3">伙伴的微信号：</p>
                    <div className="text-2xl font-black text-brand tracking-widest mb-6">{(selectedRequest.from_user_id === me?.id ? selectedRequest.to_profile : selectedRequest.from_profile)?.wechat_id}</div>
                    <button type="button" onClick={() => {
                      const wechat = (selectedRequest.from_user_id === me?.id ? selectedRequest.to_profile : selectedRequest.from_profile)?.wechat_id;
                      navigator.clipboard.writeText(wechat).then(() => { triggerToast('微信号已复制'); setTimeout(() => { window.location.href = 'weixin://'; }, 700); });
                    }} className="w-full py-5 bg-brand text-white rounded-[25px] font-black shadow-lg flex items-center justify-center space-x-2 active:scale-95 transition-all cursor-pointer">
                      <MessageSquare className="w-5 h-5" />
                      <span>复制并去微信</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 bg-slate-50 rounded-[30px] flex flex-col items-center">
                  <XCircle className="w-10 h-10 text-slate-200 mb-2" />
                  <p className="text-slate-300 font-bold">已谢绝</p>
                </div>
              )}
              
              <button type="button" onClick={(e) => deleteRequest(e, selectedRequest.id)} className="w-full py-3 text-slate-200 hover:text-accent font-bold text-xs border-2 border-dashed border-slate-50 rounded-[20px] flex items-center justify-center space-x-2 active:bg-slate-50 transition-all cursor-pointer"><Trash2 className="w-3.5 h-3.5" /><span>移除记录</span></button>
            </div>
          </div>
        </div>
      )}

      {/* 底部导航栏 */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/90 backdrop-blur-2xl px-12 py-4 pb-8 flex justify-between items-center z-40 rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.03)] border-t border-slate-100">
        {[
          { id: 'home', label: '首页', icon: Smile },
          { id: 'nearby', label: '发现', icon: Heart },
          { id: 'messages', label: '通知', icon: Bell },
          { id: 'profile', label: '我的', icon: User }
        ].map(item => (
          <button 
            type="button"
            key={item.id} 
            onClick={() => me ? setView(item.id as any) : setView('setup')} 
            className={`flex flex-col items-center transition-all duration-300 cursor-pointer ${view === item.id ? 'text-brand scale-105' : 'text-slate-300'}`}
          >
            <item.icon className={`w-6 h-6 transition-colors ${view === item.id ? 'fill-current' : ''}`} />
            <span className={`text-[9px] font-black uppercase tracking-tighter mt-1 ${view === item.id ? 'opacity-100' : 'opacity-60'}`}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
