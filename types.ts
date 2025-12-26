
export enum UserRole {
  PATIENT = '患者',
  CAREGIVER = '家属',
  VOLUNTEER = '志愿者'
}

export interface UserProfile {
  id: string;
  nickname: string;
  wechatId: string;
  role: UserRole;
  status: string; // e.g., "正在休息", "等待检查"
  locationName: string; // e.g., "B座3楼放射科", "门诊大厅长椅"
  lastLat?: number;
  lastLng?: number;
  lastActive: string;
  avatar: string;
  isVisible: boolean;
}

export interface MeetupRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  message: string;
  createdAt: string;
}

export interface LocationState {
  lat: number;
  lng: number;
  address?: string;
}
