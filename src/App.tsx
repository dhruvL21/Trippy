/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MapPin, 
  Users, 
  MessageSquare, 
  Shield, 
  Settings as SettingsIcon, 
  Plus, 
  Trash2, 
  Check, 
  RefreshCw, 
  AlertTriangle, 
  Sparkles, 
  Send, 
  CheckCircle,
  TrendingUp,
  Edit2,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { AIService } from './services/ai';
import Auth from './components/Auth';
import LandingPage from './components/LandingPage';
import { checkCognitoSession, logoutCognito } from './services/cognito';
import { Hub } from 'aws-amplify/utils';
import type { Trip, Group, Member, ChecklistItem, ChatMessage, Expense, SafetyReport, AppSettings, User } from './types';
import './App.css';
import logoImg from './assets/logo.png';

const generateId = () => Math.random().toString(36).substring(2, 9);

const fetchGroupFromDpaste = async (pasteId: string) => {
  const cleanId = pasteId.replace('.txt', '').trim();
  
  // Try fetching from ntfy.sh cache first (CORS-friendly, valid SSL)
  try {
    const res = await fetch(`https://ntfy.sh/trippy-share-${cleanId}/json?poll=1`);
    if (res.ok) {
      const text = await res.text();
      const lines = text.trim().split('\n');
      if (lines.length > 0 && lines[0]) {
        const lastLine = lines[lines.length - 1];
        const ntfyMessage = JSON.parse(lastLine);
        if (ntfyMessage && ntfyMessage.message) {
          return JSON.parse(ntfyMessage.message);
        }
      }
    }
  } catch (err) {
    console.warn("Failed to retrieve invite data from ntfy.sh cache, falling back:", err);
  }

  // Fallback to dpaste.com in case it is ever fixed/accessible
  const res = await fetch(`https://dpaste.com/${cleanId}.txt`);
  if (!res.ok) {
    throw new Error('Failed to retrieve invite data. The code may have expired or is incorrect.');
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error('Invalid data format received from invite code.', { cause: err });
  }
};



const DEFAULT_SETTINGS: AppSettings = {
  openaiApiKey: (import.meta.env.VITE_OPENAI_API_KEY as string) || '',
  openweathermapApiKey: '',
  googleMapsApiKey: '',
  model: 'gpt-4o-mini',
  userName: 'Dhruv',
  userUpi: 'dhruv@upi',
  personalInfo: '',
  phone: '',
  email: '',
  emergencyContact: ''
};

const INTERESTS_LIST = [
  { id: 'beaches', label: 'Beaches 🏖️' },
  { id: 'history', label: 'History 🏛️' },
  { id: 'nightlife', label: 'Nightlife 🪩' },
  { id: 'nature', label: 'Nature 🏔️' },
  { id: 'food', label: 'Food Crawl 🍛' },
  { id: 'shopping', label: 'Shopping 🛍️' },
  { id: 'adventure', label: 'Adventure 🧗' }
];

const CLIENT_ID = 'client-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now();

export default function App() {
  // --- Persistent States ---
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('trippy_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [isGuest, setIsGuest] = useState<boolean>(() => {
    return localStorage.getItem('trippy_is_guest') === 'true';
  });

  const [activeTab, setActiveTab] = useState<'planner' | 'safety' | 'group' | 'expenses' | 'chatbot' | 'settings'>('planner');

  const [settings, setSettings] = useState<AppSettings>(() => {
    const isG = localStorage.getItem('trippy_is_guest') === 'true';
    if (isG) return DEFAULT_SETTINGS;
    const saved = localStorage.getItem('trippy_settings');
    const parsed = saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    if (!parsed.openaiApiKey && import.meta.env.VITE_OPENAI_API_KEY) {
      parsed.openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;
    }
    if (parsed.personalInfo === undefined) {
      parsed.personalInfo = '';
    }
    if (parsed.phone === undefined) {
      parsed.phone = '';
    }
    if (parsed.email === undefined) {
      parsed.email = '';
    }
    if (parsed.emergencyContact === undefined) {
      parsed.emergencyContact = '';
    }
    return parsed;
  });

  const [activeTrip, setActiveTrip] = useState<Trip | null>(() => {
    const isG = localStorage.getItem('trippy_is_guest') === 'true';
    if (isG) return null;
    const saved = localStorage.getItem('trippy_active_trip');
    return saved ? JSON.parse(saved) : null;
  });

  const [safetyReport, setSafetyReport] = useState<SafetyReport | null>(() => {
    const isG = localStorage.getItem('trippy_is_guest') === 'true';
    if (isG) return null;
    const saved = localStorage.getItem('trippy_safety_report');
    return saved ? JSON.parse(saved) : null;
  });

  const [group, setGroup] = useState<Group>(() => {
    const isG = localStorage.getItem('trippy_is_guest') === 'true';
    if (isG) {
      return {
        id: 'group-' + generateId(),
        name: 'My Guest Group 🚀',
        members: [{ id: 'mem-1', name: 'Guest (You)', upi: '' }],
        votes: [],
        checklist: [],
        chatHistory: [
          {
            id: 'welcome-' + generateId(),
            sender: 'System',
            text: `Welcome to your guest session group! 👥\n\n(Please register to connect and sync with other travelers)`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ],
        hostId: 'mem-1'
      };
    }
    const saved = localStorage.getItem('trippy_group');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.members) {
          const savedSettings = localStorage.getItem('trippy_settings');
          const cleanUserName = savedSettings ? JSON.parse(savedSettings).userName?.trim().toLowerCase() : 'dhruv';
          
          const mem1s = parsed.members.filter((m: Member) => m.id === 'mem-1');
          if (mem1s.length > 1) {
            parsed.members = parsed.members.map((m: Member) => {
              const mClean = m.name.replace(/\s*\(You\)$/i, '').trim().toLowerCase();
              if (m.id === 'mem-1' && mClean !== cleanUserName) {
                let targetId = 'mem-' + Math.random().toString(36).substring(2, 6);
                if (parsed.hostId && parsed.hostId !== 'mem-1') {
                  targetId = parsed.hostId;
                }
                return { ...m, id: targetId };
              }
              return m;
            });
          }
        }
        return parsed;
      } catch (err) {
        console.error("Failed to parse and self-heal group from localStorage:", err);
      }
    }
    return {
      id: 'group-' + generateId(),
      name: 'My Trip Group 🚀',
      members: [
        { id: 'mem-1', name: 'Dhruv (You)', upi: 'dhruv@upi' }
      ],
      votes: [],
      checklist: [],
      chatHistory: [
        {
          id: 'welcome-' + generateId(),
          sender: 'System',
          text: `Welcome to your fresh group! 👥\n\nInvite your friends by sharing the invite code above. When they paste it, they will join this group!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ],
      hostId: 'mem-1'
    };
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const isG = localStorage.getItem('trippy_is_guest') === 'true';
    if (isG) return [];
    const saved = localStorage.getItem('trippy_expenses');
    return saved ? JSON.parse(saved) : [];
  });

  const [savedTrips, setSavedTrips] = useState<Trip[]>(() => {
    const isG = localStorage.getItem('trippy_is_guest') === 'true';
    if (isG) return [];
    const saved = localStorage.getItem('trippy_saved_trips');
    return saved ? JSON.parse(saved) : [];
  });

  const [chatbotMessages, setChatbotMessages] = useState<ChatMessage[]>(() => {
    const isG = localStorage.getItem('trippy_is_guest') === 'true';
    const welcomeMsgs = [
      {
        id: 'welcome',
        sender: 'TripPilot',
        text: `Hi there! I am your AI Travel Companion. 🗺️\n\nGenerate a trip in the **Trip Planner** tab, and I will instantly know the details to help you out!\n\nFeel free to ask me questions like:\n* *"Is UPI accepted widely in Goa?"*\n* *"What is the temple dress code in Jaipur?"*\n* *"How can I cut costs on transport?"*`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAI: true
      }
    ];
    if (isG) return welcomeMsgs;
    const saved = localStorage.getItem('trippy_chatbot_msgs');
    if (saved) return JSON.parse(saved);
    return welcomeMsgs;
  });

  // --- UI Control States ---
  const [loadingTrip, setLoadingTrip] = useState(false);
  const [loadingSafety, setLoadingSafety] = useState(false);
  const [activeItineraryDay, setActiveItineraryDay] = useState<number>(1);
  const [replanningDay, setReplanningDay] = useState<number | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLanding, setShowLanding] = useState<boolean>(() => {
    const savedUser = localStorage.getItem('trippy_user');
    const savedGuest = localStorage.getItem('trippy_is_guest');
    return !savedUser && savedGuest !== 'true';
  });
  
  // Trip Form States
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [travelers, setTravelers] = useState<number | ''>('');
  const [budgetLimit, setBudgetLimit] = useState<number | ''>('');
  const [tripType, setTripType] = useState('Leisure');
  const [accommodationPreference, setAccommodationPreference] = useState('Standard');
  const [transportPreference, setTransportPreference] = useState('train');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(['beaches', 'food', 'nightlife']);

  // Settings Temp States
  const [tempUserName, setTempUserName] = useState(settings.userName);
  const [tempUserUpi, setTempUserUpi] = useState(settings.userUpi);
  const [tempPersonalInfo, setTempPersonalInfo] = useState(settings.personalInfo || '');
  const [tempPhone, setTempPhone] = useState(settings.phone || '');
  const [tempEmail, setTempEmail] = useState(settings.email || '');
  const [tempEmergencyContact, setTempEmergencyContact] = useState(settings.emergencyContact || '');

  // Group Name Edit State
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [tempGroupNameInput, setTempGroupNameInput] = useState('');

  // Group Form States
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberUpi, setNewMemberUpi] = useState('');
  const [newChecklistText, setNewChecklistText] = useState('');
  const [newChecklistAssignee, setNewChecklistAssignee] = useState('Dhruv (You)');
  const [newVoteCity, setNewVoteCity] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [inviteLinkInput, setInviteLinkInput] = useState('');
  const [generatedGroupCode, setGeneratedGroupCode] = useState<string>('');
  const [sharingGroup, setSharingGroup] = useState<boolean>(false);

  // Expense Form States
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expensePaidBy, setExpensePaidBy] = useState('Dhruv (You)');
  const [expenseSplitWith, setExpenseSplitWith] = useState<string[]>(['Dhruv (You)', 'Aarav', 'Ananya', 'Kabir']);
  const [expenseCategory, setExpenseCategory] = useState<'accommodation' | 'transport' | 'food' | 'sightseeing' | 'shopping' | 'emergency'>('food');

  // Chatbot Input State
  const [botQuery, setBotQuery] = useState('');
  const [botLoading, setBotLoading] = useState(false);

  // UPI Settlement Modal State
  const [settlementModal, setSettlementModal] = useState<{from: string, to: string, amount: number} | null>(null);

  // Browser Notification State & Request Handler
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';
  });

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (notificationPermission === 'granted') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(title, {
            ...options,
            badge: '/favicon.svg'
          });
        }).catch(err => {
          console.error("Failed to show notification via Service Worker, falling back:", err);
          try {
            new Notification(title, options);
          } catch (e) {
            console.error("Failed fallback notification:", e);
          }
        });
      } else {
        try {
          new Notification(title, options);
        } catch (e) {
          console.error("Failed window notification:", e);
        }
      }
    }
  }, [notificationPermission]);

  const handleRequestNotificationPermission = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission().then(permission => {
        setNotificationPermission(permission);
        if (permission === 'granted') {
          alert("Notifications enabled successfully! 🔔");
          // Immediately trigger a test notification to ensure it works
          setTimeout(() => {
            showNotification("Notifications Enabled! 🔔", {
              body: "You will now receive alerts for chat messages and expenses.",
              icon: logoImg
            });
          }, 300);
        }
      });
    }
  };

  // Keep latest refs of group and expenses to avoid stale closures in EventSource SSE listener
  const latestGroupRef = useRef<Group>(group);
  const latestExpensesRef = useRef<Expense[]>(expenses);

  useEffect(() => {
    latestGroupRef.current = group;
  }, [group]);

  useEffect(() => {
    latestExpensesRef.current = expenses;
  }, [expenses]);

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const groupChatEndRef = useRef<HTMLDivElement>(null);

  // --- Sync storage changes ---
  useEffect(() => {
    localStorage.removeItem('trippy_active_tab');
  }, []);

  const handleAuthSuccess = useCallback((user: User) => {
    setCurrentUser(user);
    setIsGuest(false);
    setActiveTab('planner');
    
    // Auto-update settings with user info
    setSettings(prev => {
      const updated = {
        ...prev,
        userName: user.name,
        email: user.email
      };
      return updated;
    });

    // Keep temp states in sync
    setTempUserName(user.name);
    setTempEmail(user.email);

    // Sync member list (Dhruv -> user name) in active group
    setGroup(prev => {
      const updatedMembers = prev.members.map(m => 
        m.id === 'mem-1' ? { ...m, name: `${user.name} (You)` } : m
      );
      const updatedChecklist = prev.checklist.map(c => 
        c.assigneeName?.includes('(You)') ? { ...c, assigneeName: `${user.name} (You)` } : c
      );
      return {
        ...prev,
        members: updatedMembers,
        checklist: updatedChecklist
      };
    });
  }, []);

  // --- OAuth Callback Redirect Parser ---
  useEffect(() => {
    // Handle Google/Apple hash parameters
    const hash = window.location.hash;
    if (hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      if (accessToken) {
        fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`)
          .then(res => res.json())
          .then(data => {
            if (data.email) {
              const googleUser: User = {
                id: 'g-' + data.sub,
                name: data.name || data.email.split('@')[0],
                email: data.email,
                avatarUrl: data.picture,
                authProvider: 'google'
              };
              handleAuthSuccess(googleUser);
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          })
          .catch(err => {
            console.error("Failed to query Google UserInfo API:", err);
          });
      }
    } else if (hash.includes('id_token=')) {
      try {
        const params = new URLSearchParams(hash.substring(1));
        const idToken = params.get('id_token');
        if (idToken) {
          const base64Url = idToken.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
          const payload = JSON.parse(jsonPayload);
          
          if (payload.email) {
            const appleUser: User = {
              id: 'a-' + payload.sub,
              name: payload.email.split('@')[0],
              email: payload.email,
              authProvider: 'apple'
            };
            handleAuthSuccess(appleUser);
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
      } catch (err) {
        console.error("Failed to decode Apple token payload:", err);
      }
    }
  }, [handleAuthSuccess]);

  useEffect(() => {
    if (isGuest) return;
    localStorage.setItem('trippy_settings', JSON.stringify(settings));
  }, [settings, isGuest]);

  useEffect(() => {
    if (isGuest) return;
    localStorage.setItem('trippy_active_trip', activeTrip ? JSON.stringify(activeTrip) : '');
  }, [activeTrip, isGuest]);

  useEffect(() => {
    if (isGuest) return;
    localStorage.setItem('trippy_safety_report', safetyReport ? JSON.stringify(safetyReport) : '');
  }, [safetyReport, isGuest]);

  useEffect(() => {
    if (isGuest) return;
    localStorage.setItem('trippy_group', JSON.stringify(group));
  }, [group, isGuest]);

  useEffect(() => {
    if (isGuest) return;
    localStorage.setItem('trippy_expenses', JSON.stringify(expenses));
  }, [expenses, isGuest]);

  useEffect(() => {
    if (isGuest) return;
    localStorage.setItem('trippy_chatbot_msgs', JSON.stringify(chatbotMessages));
  }, [chatbotMessages, isGuest]);

  useEffect(() => {
    if (isGuest) return;
    localStorage.setItem('trippy_saved_trips', JSON.stringify(savedTrips));
  }, [savedTrips, isGuest]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('trippy_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('trippy_user');
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('trippy_is_guest', String(isGuest));
  }, [isGuest]);

  // Register Service Worker for mobile notification support
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => {
          console.log('Service Worker registered successfully:', reg.scope);
        })
        .catch(err => {
          console.error('Service Worker registration failed:', err);
        });
    }
  }, []);

  const broadcastGroupUpdate = useCallback((type: string, data: unknown, targetGroupId?: string) => {
    const activeGroupId = targetGroupId || latestGroupRef.current?.id;
    if (!activeGroupId || isGuest) return;
    const cleanTopic = `trippy-${activeGroupId.replace(/[^a-zA-Z0-9-_]/g, '')}`;
    fetch(`https://ntfy.sh/${cleanTopic}`, {
      method: 'POST',
      body: JSON.stringify({
        type,
        data,
        senderId: CLIENT_ID,
        senderName: settings.userName
      })
    }).catch(err => console.error("Failed to broadcast group update:", err));
  }, [isGuest, settings.userName]);

  // Auto-heal/sanitize legacy vote IDs in group.votes to stable clean names
  useEffect(() => {
    if (isGuest || !group.votes || group.votes.length === 0) return;
    
    let needsUpdate = false;
    const myName = settings.userName.replace(/\s*\(You\)$/i, '').trim();
    
    const healedVotes = group.votes.map(v => {
      const cleanVotes = v.votes.map(val => {
        const cleanVal = val.trim();
        // 1. If it matches mem-1 or currentUser.id, resolve to our clean name
        if (cleanVal === 'mem-1' || (currentUser && cleanVal === currentUser.id)) {
          if (cleanVal !== myName) {
            needsUpdate = true;
          }
          return myName;
        }
        // 2. If it matches a member ID in group.members, resolve to their clean name
        const found = group.members.find(m => m.id === cleanVal);
        if (found) {
          const memberCleanName = found.name.replace(/\s*\(You\)$/i, '').trim();
          if (cleanVal !== memberCleanName) {
            needsUpdate = true;
          }
          return memberCleanName;
        }
        return cleanVal;
      });
      
      // Remove any duplicate names that might result from mapping
      const uniqueCleanVotes = Array.from(new Set(cleanVotes));
      if (uniqueCleanVotes.length !== v.votes.length) {
        needsUpdate = true;
      }
      
      return {
        ...v,
        votes: uniqueCleanVotes
      };
    });

    if (needsUpdate) {
      setGroup(prev => ({
        ...prev,
        votes: healedVotes
      }));
      broadcastGroupUpdate('votes_sync', healedVotes);
    }
  }, [group.votes, group.members, currentUser, settings.userName, isGuest, broadcastGroupUpdate]);

  // Helper to join a shared group and map sender/receiver identities
  const performJoinGroup = useCallback((decoded: { activeTrip?: Trip | null; group?: Group; expenses?: Expense[] }) => {
    if (!decoded) return;
    
    // 1. Process active trip
    if (decoded.activeTrip) {
      setActiveTrip(decoded.activeTrip);
      if (!isGuest) localStorage.setItem('trippy_active_trip', JSON.stringify(decoded.activeTrip));
    }
    
    // 2. Process group and re-map member identities
    if (decoded.group) {
      const originalMembers = decoded.group.members || [];
      const senderInDecoded = originalMembers.find(m => m.id === 'mem-1');
      
      const receiverName = `${settings.userName} (You)`;
      const receiverUpi = settings.userUpi;
      
      let newMembers: Member[];
      const newSenderId = 'mem-sender-' + Math.random().toString(36).substring(2, 6);
      
      if (senderInDecoded) {
        const senderCleanName = senderInDecoded.name.replace(/\s*\(You\)$/i, '');
        
        // Filter out any members that match current user's name to avoid duplicates
        const cleanUserName = settings.userName.trim();
        newMembers = originalMembers
          .filter(m => {
            const mClean = m.name.replace(/\s*\(You\)$/i, '').trim();
            return m.id !== 'mem-1' && mClean.toLowerCase() !== cleanUserName.toLowerCase();
          })
          .map(m => ({
            ...m,
            name: m.name.replace(/\s*\(You\)$/i, '').trim()
          }));
        
        // Add sender back as a normal member
        newMembers.push({
          id: newSenderId,
          name: senderCleanName,
          upi: senderInDecoded.upi
        });
        
        // Add receiver as 'mem-1'
        newMembers.unshift({
          id: 'mem-1',
          name: receiverName,
          upi: receiverUpi
        });
        
        // Convert any vote IDs to member names for stability
        if (decoded.group.votes) {
          decoded.group.votes = decoded.group.votes.map(v => ({
            ...v,
            votes: v.votes.map((idOrName: string) => {
              if (idOrName === 'mem-1') {
                return senderCleanName;
              }
              const found = originalMembers.find(m => m.id === idOrName);
              if (found) {
                return found.name.replace(/\s*\(You\)$/i, '').trim();
              }
              return idOrName;
            })
          }));
        }
        
        // Update checklist assignees
        if (decoded.group.checklist) {
          const senderOldLabel = senderInDecoded.name;
          const senderNewLabel = senderCleanName;
          
          decoded.group.checklist = decoded.group.checklist.map(item => {
            let newAssignee = item.assigneeName;
            if (item.assigneeName === senderOldLabel) {
              newAssignee = senderNewLabel;
            } else if (item.assigneeName?.replace(/\s*\(You\)$/i, '').trim().toLowerCase() === settings.userName.toLowerCase()) {
              newAssignee = receiverName;
            }
            return { ...item, assigneeName: newAssignee };
          });
        }
        
        // Update expenses
        if (decoded.expenses) {
          const senderOldLabel = senderInDecoded.name;
          const senderNewLabel = senderCleanName;
          const receiverCleanName = settings.userName;
          const receiverLabel = receiverName;
          
          decoded.expenses = decoded.expenses.map(exp => {
            let newPaidBy = exp.paidBy;
            if (exp.paidBy === senderOldLabel) {
              newPaidBy = senderNewLabel;
            } else if (exp.paidBy === receiverCleanName) {
              newPaidBy = receiverLabel;
            }
            
            const newSplitWith = exp.splitWith.map((name: string) => {
              if (name === senderOldLabel) return senderNewLabel;
              if (name === receiverCleanName) return receiverLabel;
              return name;
            });
            
            return { ...exp, paidBy: newPaidBy, splitWith: newSplitWith };
          });
        }
      } else {
        newMembers = originalMembers
          .filter(m => m.id !== 'mem-1')
          .map(m => ({
            ...m,
            name: m.name.replace(/\s*\(You\)$/i, '').trim()
          }));
        newMembers.unshift({
          id: 'mem-1',
          name: receiverName,
          upi: receiverUpi
        });
      }
      
      if (senderInDecoded) {
        decoded.group.hostId = newSenderId;
      }
      decoded.group.members = newMembers;
      setGroup(decoded.group);
      if (!isGuest) localStorage.setItem('trippy_group', JSON.stringify(decoded.group));
    }
    
    // 3. Process expenses
    if (decoded.expenses) {
      setExpenses(decoded.expenses);
      if (!isGuest) localStorage.setItem('trippy_expenses', JSON.stringify(decoded.expenses));
    }
    
    // 4. Safety report loading
    if (decoded.activeTrip) {
      AIService.generateSafetyReport(decoded.activeTrip.destination, settings.openaiApiKey, settings.model)
        .then(report => setSafetyReport(report))
        .catch(err => console.error('Failed to load safety report for shared trip', err));
    }

    // 5. Broadcast our join event
    const myMemberObj = {
      id: currentUser?.id || 'mem-' + Math.random().toString(36).substring(2, 6),
      name: settings.userName,
      upi: settings.userUpi
    };
    setTimeout(() => {
      broadcastGroupUpdate('member_join', myMemberObj, decoded.group?.id);
    }, 500);
  }, [settings.userName, settings.userUpi, settings.openaiApiKey, settings.model, isGuest, broadcastGroupUpdate, currentUser]);

  // Handler to parse and connect group via invite link or code paste field
  const handleConnectInviteLink = async (linkOrCode: string) => {
    const trimmed = linkOrCode.trim();
    if (!trimmed) return;

    // Check if it's a dpaste URL or a short code (alphanumeric, length 6-12)
    let isDpaste = false;
    let dpasteCode = trimmed;

    if (trimmed.includes('dpaste.com') || trimmed.includes('dpaste.org')) {
      isDpaste = true;
      const urlParts = trimmed.split('/');
      dpasteCode = urlParts[urlParts.length - 1].split('.')[0];
    } else if (trimmed.length >= 6 && trimmed.length <= 12 && /^[a-zA-Z0-9]+$/.test(trimmed)) {
      isDpaste = true;
    }

    if (isDpaste) {
      try {
        const decoded = await fetchGroupFromDpaste(dpasteCode);
        
        // Safety Check: block the admin/host from joining their own group again
        if (decoded.group && decoded.group.id === group.id) {
          alert("You are already the host/admin of this group! 👥");
          setInviteLinkInput('');
          return;
        }

        performJoinGroup(decoded);
        setInviteLinkInput('');
        alert(`Successfully joined group trip "${decoded.group?.name || 'Vacation'}" via invite code! 👥✈️`);
      } catch (err) {
        console.error("Failed to connect via invite code:", err);
        alert((err as Error).message || "Invalid invite code or server error. Please check and try again.");
      }
    } else {
      // Fallback to legacy base64 URL/string parsing
      try {
        let base64Data = trimmed;
        if (base64Data.includes('join=')) {
          const parts = base64Data.split('join=');
          base64Data = parts[1].split('&')[0];
        } else if (base64Data.includes('?')) {
          const params = new URLSearchParams(base64Data.substring(base64Data.indexOf('?')));
          const joinVal = params.get('join');
          if (joinVal) {
            base64Data = joinVal;
          }
        }
        
        const decoded = JSON.parse(decodeURIComponent(atob(base64Data)));
        
        // Safety Check: block the admin/host from joining their own group again
        if (decoded.group && decoded.group.id === group.id) {
          alert("You are already the host/admin of this group! 👥");
          setInviteLinkInput('');
          return;
        }

        performJoinGroup(decoded);
        setInviteLinkInput('');
        alert(`Successfully joined group trip "${decoded.group?.name || 'Vacation'}"! 👥✈️`);
      } catch (err) {
        console.error("Failed to decode group from pasted invite link:", err);
        alert("Invalid invite link or code format. Please check and try again.");
      }
    }
  };

  // Check for shared trip or group invite query param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tripParam = params.get('trip');
    const joinParam = params.get('join');

    if (tripParam) {
      try {
        const decoded = JSON.parse(decodeURIComponent(atob(tripParam)));
        setActiveTrip(decoded);
        setActiveItineraryDay(1);
        
        // Load related safety report
        AIService.generateSafetyReport(decoded.destination, settings.openaiApiKey, settings.model)
          .then(report => setSafetyReport(report))
          .catch(err => console.error('Failed to load safety report for shared trip', err));
          
        // Clean query parameter from URL
        window.history.replaceState({}, document.title, window.location.pathname);
        alert(`Loaded shared itinerary to ${decoded.destination}! ✈️`);
      } catch (err) {
        console.error("Failed to decode shared trip from URL:", err);
      }
    } else if (joinParam) {
      const trimmed = joinParam.trim();
      let isDpaste = false;
      const dpasteCode = trimmed;

      if (trimmed.length >= 6 && trimmed.length <= 12 && /^[a-zA-Z0-9]+$/.test(trimmed)) {
        isDpaste = true;
      }

      if (isDpaste) {
        fetchGroupFromDpaste(dpasteCode)
          .then(decoded => {
            performJoinGroup(decoded);
            window.history.replaceState({}, document.title, window.location.pathname);
            alert(`Successfully joined group trip "${decoded.group?.name || 'Vacation'}" via invite code! 👥✈️`);
          })
          .catch(err => {
            console.error("Failed to decode shared group from URL param:", err);
          });
      } else {
        try {
          const decoded = JSON.parse(decodeURIComponent(atob(trimmed)));
          performJoinGroup(decoded);
          
          // Clean query parameter from URL
          window.history.replaceState({}, document.title, window.location.pathname);
          alert(`Successfully joined group trip "${decoded.group?.name || 'Vacation'}"! 👥✈️`);
        } catch (err) {
          console.error("Failed to decode shared group from URL:", err);
        }
      }
    }
  }, [settings.model, settings.openaiApiKey, performJoinGroup]);

  // Real-time group collaboration subscription via ntfy.sh SSE
  useEffect(() => {
    if (!group || !group.id || isGuest) return;
    
    const cleanTopic = `trippy-${group.id.replace(/[^a-zA-Z0-9-_]/g, '')}`;
    const eventSource = new EventSource(`https://ntfy.sh/${cleanTopic}/sse`);
    
    eventSource.onopen = () => {
      // Prompt other active peers to send us the current state
      setTimeout(() => {
        fetch(`https://ntfy.sh/${cleanTopic}`, {
          method: 'POST',
          body: JSON.stringify({
            type: 'request_sync',
            senderId: CLIENT_ID,
            senderName: settings.userName
          })
        }).catch(err => console.error("Failed to send request_sync on EventSource open:", err));
      }, 500);
    };

    eventSource.onmessage = (event) => {
      try {
        const ntfyData = JSON.parse(event.data);
        if (ntfyData.event !== 'message') return;
        
        const update = JSON.parse(ntfyData.message);
        
        // Skip updates sent by the local client itself
        if (update.senderId === CLIENT_ID) return;
        
        switch (update.type) {
          case 'request_sync': {
            if (update.senderId !== CLIENT_ID) {
              const currentGroup = latestGroupRef.current;
              const currentExpenses = latestExpensesRef.current;
              
              // Broadcast current states back to the new participant
              broadcastGroupUpdate('members_sync', currentGroup.members);
              broadcastGroupUpdate('checklist_sync', currentGroup.checklist);
              broadcastGroupUpdate('expenses_sync', currentExpenses);
              broadcastGroupUpdate('votes_sync', currentGroup.votes);
              broadcastGroupUpdate('group_name_update', currentGroup.name);
            }
            break;
          }
          case 'chat': {
            const chatMsg = update.data;
            
            // Trigger desktop/mobile notification if message is from someone else
            const cleanSender = chatMsg.sender.replace(/\s*\(You\)$/i, '').trim();
            const isMe = cleanSender.toLowerCase() === settings.userName.trim().toLowerCase() || chatMsg.sender.includes('(You)');
            
            if (!isMe) {
              showNotification(`New message from ${cleanSender} 💬`, {
                body: chatMsg.text,
                icon: logoImg
              });
            }

            setGroup(prev => {
              if (prev.chatHistory.some(m => m.id === chatMsg.id)) return prev;
              
              // Ensure sender is in the group members list
              const updatedMembers = [...prev.members];
              const senderClean = chatMsg.sender.trim();
              const exists = updatedMembers.some(m => m.name.replace(/\s*\(You\)$/i, '').trim().toLowerCase() === senderClean.toLowerCase());
              if (!exists && chatMsg.sender !== 'System' && chatMsg.sender !== 'TripPilot') {
                updatedMembers.push({
                  id: 'mem-' + Math.random().toString(36).substring(2, 6),
                  name: senderClean,
                  upi: ''
                });
              }
              return {
                ...prev,
                members: updatedMembers,
                chatHistory: [...prev.chatHistory, chatMsg]
              };
            });
            break;
          }
          case 'member_join': {
            const newMember = update.data;
            setGroup(prev => {
              const exists = prev.members.some(m => m.name.replace(/\s*\(You\)$/i, '').trim().toLowerCase() === newMember.name.trim().toLowerCase());
              if (exists) return prev;
              
              const cleanedNewMember = {
                ...newMember,
                name: newMember.name.replace(/\s*\(You\)$/i, '').trim()
              };
              
              return {
                ...prev,
                members: [...prev.members, cleanedNewMember]
              };
            });
            break;
          }
          case 'member_leave': {
            const leavingMember = update.data;
            setGroup(prev => {
              const cleanLeaving = leavingMember.name.trim().toLowerCase();
              const updatedMembers = prev.members.filter(m => m.name.replace(/\s*\(You\)$/i, '').trim().toLowerCase() !== cleanLeaving);
              return {
                ...prev,
                members: updatedMembers
              };
            });
            break;
          }
          case 'members_sync': {
            const syncedMembers = update.data;

            // Check if we have been removed by the admin
            const cleanLoc = settings.userName.trim().toLowerCase();
            const stillInGroup = syncedMembers.some((m: Member) => {
              const cleanM = m.name.replace(/\s*\(You\)$/i, '').trim().toLowerCase();
              return cleanM === cleanLoc;
            });
            
            const isLocalAdmin = !latestGroupRef.current?.hostId || latestGroupRef.current?.hostId === 'mem-1';
            
            if (!stillInGroup && !isLocalAdmin && syncedMembers.length > 0) {
              alert("You have been removed from this group by the admin. 👥");
              const newGroup: Group = {
                id: 'group-' + generateId(),
                name: `${settings.userName}'s Trip Group 🚀`,
                members: [
                  { id: 'mem-1', name: `${settings.userName} (You)`, upi: settings.userUpi }
                ],
                votes: [],
                checklist: [],
                chatHistory: [
                  {
                    id: 'welcome-' + generateId(),
                    sender: 'System',
                    text: `Welcome to your fresh group! 👥\n\nInvite your friends by generating an invite code above. When they enter the code in their Group Hub, they will join this group!`,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  }
                ],
                hostId: 'mem-1'
              };
              setGroup(newGroup);
              setExpenses([]);
              if (!isGuest) {
                localStorage.setItem('trippy_group', JSON.stringify(newGroup));
                localStorage.setItem('trippy_expenses', JSON.stringify([]));
              }
              break;
            }

            setGroup(prev => {
              // Merge members: keep local user (mem-1) name, but update other members
              const localUser = prev.members.find(m => m.id === 'mem-1') || { id: 'mem-1', name: `${settings.userName} (You)`, upi: settings.userUpi };
              
              const filteredIncoming = syncedMembers
                .filter((m: Member) => {
                  const cleanInc = m.name.replace(/\s*\(You\)$/i, '').trim().toLowerCase();
                  const cleanLocName = settings.userName.trim().toLowerCase();
                  return cleanInc !== cleanLocName;
                })
                .map((m: Member) => {
                  const cleanName = m.name.replace(/\s*\(You\)$/i, '').trim();
                  
                  // Check if this member is the admin/host (when we are not the admin)
                  const isHost = prev.hostId && prev.hostId !== 'mem-1' && m.id === 'mem-1';
                  let targetId = m.id;
                  
                  if (isHost) {
                    targetId = prev.hostId!;
                  } else if (m.id === 'mem-1') {
                    // This is another device's local user, so it collided with our 'mem-1'.
                    // Check if we already have this member by name in our list and reuse their ID.
                    const existing = prev.members.find(
                      ex => ex.name.replace(/\s*\(You\)$/i, '').trim().toLowerCase() === cleanName.toLowerCase()
                    );
                    targetId = existing ? existing.id : 'mem-' + Math.random().toString(36).substring(2, 6);
                  }
                  
                  return {
                    ...m,
                    id: targetId,
                    name: cleanName
                  };
                });
              
              const merged = [localUser, ...filteredIncoming];
              
              // Remove duplicate names if any
              const uniqueMerged: Member[] = [];
              const seen = new Set();
              merged.forEach(m => {
                const cleanName = m.name.replace(/\s*\(You\)$/i, '').trim().toLowerCase();
                if (!seen.has(cleanName)) {
                  seen.add(cleanName);
                  uniqueMerged.push(m);
                }
              });
              
              return {
                ...prev,
                members: uniqueMerged
              };
            });
            break;
          }
          case 'votes_sync': {
            const syncedVotes = update.data;
            setGroup(prev => ({
              ...prev,
              votes: syncedVotes
            }));
            break;
          }
          case 'checklist_sync': {
            const syncedChecklist = update.data;
            setGroup(prev => ({
              ...prev,
              checklist: syncedChecklist
            }));
            break;
          }
          case 'expenses_sync': {
            const syncedExpenses = update.data;
            
            // Check for new expenses added by comparing with latest expenses ref
            const currentExpenses = latestExpensesRef.current;
            const newItems = syncedExpenses.filter((e: Expense) => !currentExpenses.some(old => old.id === e.id));
            
            if (newItems.length > 0) {
              const newExp = newItems[0];
              const cleanPaidBy = newExp.paidBy.replace(/\s*\(You\)$/i, '').trim();
              const isMe = cleanPaidBy.toLowerCase() === settings.userName.trim().toLowerCase();
              
              if (!isMe) {
                showNotification(`New Expense Added 💸`, {
                  body: `${cleanPaidBy} added "${newExp.title}" - ₹${newExp.amount}`,
                  icon: logoImg
                });
              }
            }

            setExpenses(syncedExpenses);
            break;
          }
          case 'group_name_update': {
            const newName = update.data;
            setGroup(prev => ({
              ...prev,
              name: newName
            }));
            break;
          }
          default:
            break;
        }
      } catch (err) {
        console.error("Failed to parse real-time update:", err);
      }
    };
    
    eventSource.onerror = () => {
      console.warn("EventSource error, will auto-reconnect.");
    };
    
    return () => {
      eventSource.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id, isGuest, settings.userName, settings.userUpi, broadcastGroupUpdate, showNotification]);

  // Scroll chats to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatbotMessages, botLoading]);

  useEffect(() => {
    groupChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [group.chatHistory]);

  // Sync names in expense dropdown when group members change
  useEffect(() => {
    if (group.members.length > 0) {
      setExpenseSplitWith(group.members.map(m => m.name));
      if (!group.members.some(m => m.name === expensePaidBy)) {
        setExpensePaidBy(group.members[0].name);
      }
    }
  }, [group.members, expensePaidBy]);

  // --- Handlers ---
  const handleSaveTrip = () => {
    if (!activeTrip) return;
    if (savedTrips.some(t => t.id === activeTrip.id)) {
      alert('This trip is already saved!');
      return;
    }
    setSavedTrips(prev => [activeTrip, ...prev]);
    alert(`Trip to ${activeTrip.destination} saved successfully!`);
  };

  const handleDeleteSavedTrip = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this saved trip?')) {
      setSavedTrips(prev => prev.filter(t => t.id !== id));
    }
  };

  const handleLoadSavedTrip = (trip: Trip) => {
    setActiveTrip(trip);
    setActiveItineraryDay(1);
    
    // Sync form inputs to loaded trip
    setSource(trip.source);
    setDestination(trip.destination);
    setStartDate(trip.startDate);
    setEndDate(trip.endDate);
    setTravelers(trip.travelers);
    setBudgetLimit(trip.budgetLimit);
    setTripType(trip.tripType);
    setAccommodationPreference(trip.accommodationPreference);
    setTransportPreference(trip.transportPreference);
    
    // Load related safety report
    AIService.generateSafetyReport(trip.destination, settings.openaiApiKey, settings.model)
      .then(report => setSafetyReport(report))
      .catch(err => console.error(err));
      
    // Initialize default expenses for this loaded trip
    const updatedGroupMembers = [
      { id: 'mem-1', name: `${settings.userName} (You)`, upi: settings.userUpi },
      ...Array.from({ length: Math.max(0, Number(trip.travelers) - 1) }).map((_, i) => ({
        id: `mem-gen-${i}`,
        name: `Traveler ${i + 2}`,
        upi: `traveler${i + 2}@upi`
      }))
    ];

    const initialExpenses: Expense[] = [];
    const categories: ('accommodation' | 'transport' | 'food' | 'sightseeing' | 'shopping' | 'emergency')[] = [
      'accommodation',
      'transport',
      'food',
      'sightseeing',
      'shopping',
      'emergency'
    ];

    categories.forEach((cat, index) => {
      const amount = trip.costBreakdown[cat];
      if (amount > 0) {
        let title = '';
        if (cat === 'accommodation') title = 'Planned Accommodation';
        else if (cat === 'transport') title = `Planned Transport (${trip.transportPreference})`;
        else if (cat === 'food') title = 'Planned Food & Dining';
        else if (cat === 'sightseeing') title = 'Planned Sightseeing & Activities';
        else if (cat === 'shopping') title = 'Planned Shopping';
        else if (cat === 'emergency') title = 'Planned Emergency Buffer';

        initialExpenses.push({
          id: `init-exp-${index + 1}`,
          title,
          amount,
          paidBy: `${settings.userName} (You)`,
          splitWith: updatedGroupMembers.map(m => m.name),
          category: cat,
          date: trip.startDate
        });
      }
    });
    setExpenses(initialExpenses);
      
    alert(`Loaded active trip to ${trip.destination}!`);
  };

  const handleShareTrip = () => {
    if (!activeTrip) return;
    try {
      const serialized = btoa(encodeURIComponent(JSON.stringify(activeTrip)));
      const shareUrl = `${window.location.origin}${window.location.pathname}?trip=${serialized}`;
      
      navigator.clipboard.writeText(shareUrl).then(() => {
        alert('Shareable link copied to clipboard! Share it with friends to show them this itinerary.');
      }).catch(err => {
        console.error('Failed to copy link:', err);
        prompt('Copy this link to share:', shareUrl);
      });
    } catch (err) {
      console.error('Failed to generate share link:', err);
    }
  };

  const handleShareGroupCode = async () => {
    setSharingGroup(true);
    try {
      const shareData = {
        activeTrip: activeTrip,
        group: group,
        expenses: expenses
      };
      const payload = JSON.stringify(shareData);
      
      const code = generateId();
      
      // Publish state to ntfy.sh cache topic (CORS-friendly, valid SSL)
      const response = await fetch(`https://ntfy.sh/trippy-share-${code}`, {
        method: 'POST',
        body: payload
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate invite code on ntfy.sh');
      }
      
      setGeneratedGroupCode(code);
      await navigator.clipboard.writeText(code);
      alert(`Group invite code "${code}" generated and copied to clipboard! Share it with friends to sync the itinerary, checklist, and expenses.`);
    } catch (err) {
      console.error('Failed to generate invite code:', err);
      alert('Failed to generate group invite code. Please try again.');
    } finally {
      setSharingGroup(false);
    }
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to log out?')) {
      if (currentUser?.authProvider === 'cognito') {
        logoutCognito().catch(err => console.error('Failed to log out from Cognito:', err));
      }
      setCurrentUser(null);
      setIsGuest(false);
      
      // Remove all user-related data from local storage
      localStorage.removeItem('trippy_user');
      localStorage.removeItem('trippy_is_guest');
      localStorage.removeItem('trippy_active_trip');
      localStorage.removeItem('trippy_group');
      localStorage.removeItem('trippy_expenses');
      localStorage.removeItem('trippy_safety_report');
      localStorage.removeItem('trippy_chatbot_msgs');
      localStorage.removeItem('trippy_saved_trips');
      localStorage.removeItem('trippy_settings');
      
      // Reset settings
      setSettings(DEFAULT_SETTINGS);
      setTempUserName(DEFAULT_SETTINGS.userName);
      setTempUserUpi(DEFAULT_SETTINGS.userUpi);
      setTempPersonalInfo(DEFAULT_SETTINGS.personalInfo);
      setTempPhone(DEFAULT_SETTINGS.phone);
      setTempEmail(DEFAULT_SETTINGS.email);
      setTempEmergencyContact(DEFAULT_SETTINGS.emergencyContact);
      
      // Reset active trip, saved trips, and safety reports
      setActiveTrip(null);
      setSafetyReport(null);
      setSavedTrips([]);
      setInviteLinkInput('');
      
      // Reset group to fresh empty state
      const freshGroup: Group = {
        id: 'group-' + generateId(),
        name: 'My Trip Group 🚀',
        members: [
          { id: 'mem-1', name: 'Dhruv (You)', upi: 'dhruv@upi' }
        ],
        votes: [],
        checklist: [],
        chatHistory: [
          {
            id: 'welcome-' + generateId(),
            sender: 'System',
            text: `Welcome to your fresh group! 👥\n\nInvite your friends by generating an invite code above. When they enter the code in their Group Hub, they will join this group!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ],
        hostId: 'mem-1'
      };
      setGroup(freshGroup);
      setExpenses([]);
      setChatbotMessages([
        {
          id: 'welcome',
          sender: 'TripPilot',
          text: `Hi there! I am your AI Travel Companion. 🗺️\n\nGenerate a trip in the **Trip Planner** tab, and I will instantly know the details to help you out!\n\nFeel free to ask me questions like:\n* *"Is UPI accepted widely in Goa?"*\n* *"What is the temple dress code in Jaipur?"*\n* *"How can I cut costs on transport?"*`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isAI: true
        }
      ]);
      setShowLanding(true);

      alert('Logged out successfully.');
    }
  };

  // --- Cognito Session check on mount ---
  const resolveUserSession = useCallback(() => {
    checkCognitoSession().then(user => {
      if (user) {
        handleAuthSuccess(user);
      }
    }).catch(err => {
      console.error('Failed to resolve Cognito user session:', err);
    });
  }, [handleAuthSuccess]);

  useEffect(() => {
    resolveUserSession();

    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signInWithRedirect') {
        resolveUserSession();
      } else if (payload.event === 'signInWithRedirect_failure') {
        console.error('Cognito sign-in redirect flow failure:', payload.data);
      }
    });

    return () => unsubscribe();
  }, [resolveUserSession]);

  const toggleInterest = (id: string) => {
    setSelectedInterests(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleGenerateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingTrip(true);
    setLoadingSafety(true);

    try {
      const interestsLabels = selectedInterests.map(id => INTERESTS_LIST.find(i => i.id === id)?.label || id);
      
      const tripParams = {
        source,
        destination,
        startDate,
        endDate,
        travelers: Number(travelers) || 1,
        budgetLimit: Number(budgetLimit) || 1000,
        interests: interestsLabels,
        tripType,
        accommodationPreference,
        transportPreference
      };

      const trip = await AIService.generateItinerary(tripParams, settings.openaiApiKey, settings.model);
      setActiveTrip(trip);
      setActiveItineraryDay(1);

      // Fetch Safety Report
      const safety = await AIService.generateSafetyReport(destination, settings.openaiApiKey, settings.model);
      setSafetyReport(safety);

      // Initialize Bot greeting based on trip
      const firstMsg: ChatMessage = {
        id: generateId(),
        sender: 'TripPilot',
        text: `Awesome! Generated your trip to **${destination}**! 🎒\n\nI can give you customized safety guides, help manage expenses, or discuss temple dress codes and transport options here.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAI: true
      };
      setChatbotMessages([firstMsg]);

      // Sync members to include in active group
      const updatedGroupMembers = [
        { id: 'mem-1', name: `${settings.userName} (You)`, upi: settings.userUpi },
        ...Array.from({ length: Math.max(0, Number(travelers) - 1) }).map((_, i) => ({
          id: `mem-gen-${i}`,
          name: `Traveler ${i + 2}`,
          upi: `traveler${i + 2}@upi`
        }))
      ];
      setGroup(prev => ({
        ...prev,
        members: updatedGroupMembers,
        // Reset checklist to represent new trip context
        checklist: [
          { id: 'c-1', text: `Review emergency contacts in ${destination}`, checked: false, assigneeName: `${settings.userName} (You)` },
          ...trip.packingList.slice(0, 3).map((item, idx) => ({
            id: `c-pack-${idx}`,
            text: `Pack: ${item}`,
            checked: false,
            assigneeName: updatedGroupMembers[idx % updatedGroupMembers.length].name
          }))
        ]
      }));

      // Initialize default expenses for this new trip
      const initialExpenses: Expense[] = [];
      const categories: ('accommodation' | 'transport' | 'food' | 'sightseeing' | 'shopping' | 'emergency')[] = [
        'accommodation',
        'transport',
        'food',
        'sightseeing',
        'shopping',
        'emergency'
      ];

      categories.forEach((cat, index) => {
        const amount = trip.costBreakdown[cat];
        if (amount > 0) {
          let title = '';
          if (cat === 'accommodation') title = 'Planned Accommodation';
          else if (cat === 'transport') title = `Planned Transport (${transportPreference})`;
          else if (cat === 'food') title = 'Planned Food & Dining';
          else if (cat === 'sightseeing') title = 'Planned Sightseeing & Activities';
          else if (cat === 'shopping') title = 'Planned Shopping';
          else if (cat === 'emergency') title = 'Planned Emergency Buffer';

          initialExpenses.push({
            id: `init-exp-${index + 1}`,
            title,
            amount,
            paidBy: `${settings.userName} (You)`,
            splitWith: updatedGroupMembers.map(m => m.name),
            category: cat,
            date: startDate
          });
        }
      });
      setExpenses(initialExpenses);

    } catch (err) {
      alert((err as Error).message || 'Failed to generate travel plan.');
    } finally {
      setLoadingTrip(false);
      setLoadingSafety(false);
    }
  };

  const handleReplanning = async (reason: string) => {
    if (!activeTrip) return;
    setReplanningDay(activeItineraryDay);

    try {
      const updatedDay = await AIService.generateReplannedItinerary(
        activeTrip,
        activeItineraryDay,
        reason,
        settings.openaiApiKey,
        settings.model
      );

      const newItinerary = activeTrip.itinerary.map(day => 
        day.dayNumber === activeItineraryDay ? updatedDay : day
      );

      // Recalculate totals
      let accommodation = 0;
      let transport = 0;
      let food = 0;
      let sightseeing = 0;
      let shopping = 0;
      let emergency = 0;

      newItinerary.forEach(day => {
        day.activities.forEach(act => {
          if (act.type === 'accommodation') accommodation += act.cost;
          else if (act.type === 'transport') transport += act.cost;
          else if (act.type === 'food') food += act.cost;
          else if (act.type === 'sightseeing') sightseeing += act.cost;
          else if (act.type === 'shopping') shopping += act.cost;
          else emergency += act.cost;
        });
      });

      const total = accommodation + transport + food + sightseeing + shopping + emergency;

      const updatedTrip: Trip = {
        ...activeTrip,
        itinerary: newItinerary,
        costBreakdown: {
          accommodation,
          transport,
          food,
          sightseeing,
          shopping,
          emergency,
          total
        }
      };

      setActiveTrip(updatedTrip);
      
      // Update expenses to match replanned breakdown
      const initialExpenses: Expense[] = [];
      const categories: ('accommodation' | 'transport' | 'food' | 'sightseeing' | 'shopping' | 'emergency')[] = [
        'accommodation',
        'transport',
        'food',
        'sightseeing',
        'shopping',
        'emergency'
      ];

      categories.forEach((cat, index) => {
        const amount = updatedTrip.costBreakdown[cat];
        if (amount > 0) {
          let title = '';
          if (cat === 'accommodation') title = 'Planned Accommodation';
          else if (cat === 'transport') title = `Planned Transport (${updatedTrip.transportPreference})`;
          else if (cat === 'food') title = 'Planned Food & Dining';
          else if (cat === 'sightseeing') title = 'Planned Sightseeing & Activities';
          else if (cat === 'shopping') title = 'Planned Shopping';
          else if (cat === 'emergency') title = 'Planned Emergency Buffer';

          initialExpenses.push({
            id: `init-exp-${index + 1}`,
            title,
            amount,
            paidBy: `${settings.userName} (You)`,
            splitWith: group.members.map(m => m.name),
            category: cat,
            date: updatedTrip.startDate
          });
        }
      });
      setExpenses(initialExpenses);
      
      // Update chatbot with notice
      const botNotice: ChatMessage = {
        id: generateId(),
        sender: 'TripPilot',
        text: `⚠️ **Itinerary Re-routed**: I have dynamically updated the schedule for **Day ${activeItineraryDay}** in ${activeTrip.destination} due to your report of: *"${reason}"*. Out-door plans have been adjusted to keep your journey smooth!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAI: true
      };
      setChatbotMessages(prev => [...prev, botNotice]);
    } catch (err) {
      alert((err as Error).message || 'Replanning failed.');
    } finally {
      setReplanningDay(null);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedSettings: AppSettings = {
      openaiApiKey: settings.openaiApiKey,
      openweathermapApiKey: settings.openweathermapApiKey,
      googleMapsApiKey: settings.googleMapsApiKey,
      model: settings.model,
      userName: tempUserName,
      userUpi: tempUserUpi,
      personalInfo: tempPersonalInfo,
      phone: tempPhone,
      email: tempEmail,
      emergencyContact: tempEmergencyContact
    };
    setSettings(updatedSettings);

    // Update member list (Dhruv -> new name) in active group
    setGroup(prev => {
      const updatedMembers = prev.members.map(m => 
        m.id === 'mem-1' ? { ...m, name: `${tempUserName} (You)`, upi: tempUserUpi } : m
      );
      const updatedChecklist = prev.checklist.map(c => 
        c.assigneeName?.includes('(You)') ? { ...c, assigneeName: `${tempUserName} (You)` } : c
      );
      return {
        ...prev,
        members: updatedMembers,
        checklist: updatedChecklist
      };
    });

    alert('Settings saved successfully!');
  };

  const handleSaveGroupName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempGroupNameInput.trim()) return;
    const newName = tempGroupNameInput.trim();
    setGroup(prev => ({
      ...prev,
      name: newName
    }));
    setIsEditingGroupName(false);
    broadcastGroupUpdate('group_name_update', newName);
  };

  // Group Handlers
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;

    const newMember: Member = {
      id: generateId(),
      name: newMemberName.trim(),
      upi: newMemberUpi.trim() || undefined
    };

    const updatedMembers = [...group.members, newMember];
    setGroup(prev => ({
      ...prev,
      members: updatedMembers
    }));
    broadcastGroupUpdate('members_sync', updatedMembers);

    setNewMemberName('');
    setNewMemberUpi('');
  };

  const handleRemoveMember = (id: string) => {
    if (id === 'mem-1') return; // Cannot delete self
    
    const memberToRemove = group.members.find(m => m.id === id);
    if (!memberToRemove) return;
    
    const cleanName = memberToRemove.name.replace(/\s*\(You\)$/i, '').trim();
    if (!confirm(`Are you sure you want to remove ${cleanName} from the group?`)) return;

    const updatedMembers = group.members.filter(m => m.id !== id);
    setGroup(prev => ({
      ...prev,
      members: updatedMembers
    }));
    
    // Broadcast updated list to peers
    broadcastGroupUpdate('members_sync', updatedMembers);
    
    // Broadcast a system message inside chat
    const removeMsg = {
      id: 'sys-' + generateId(),
      sender: 'System',
      text: `${cleanName} has been removed from the group by the admin. 👥`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    broadcastGroupUpdate('chat', removeMsg);
  };

  const handleVote = (city: string) => {
    const myName = settings.userName.replace(/\s*\(You\)$/i, '').trim();
    const updatedVotes = group.votes.map(v => {
      if (v.city === city) {
        // Normalize votes list to clean names
        const cleanVotes = v.votes.map(val => {
          if (val === 'mem-1' || (currentUser && val === currentUser.id)) {
            return settings.userName.replace(/\s*\(You\)$/i, '').trim();
          }
          const found = group.members.find(m => m.id === val);
          if (found) return found.name.replace(/\s*\(You\)$/i, '').trim();
          return val;
        });
        const hasVoted = cleanVotes.some(name => name.toLowerCase() === myName.toLowerCase());
        const newVotes = hasVoted
          ? cleanVotes.filter(name => name.toLowerCase() !== myName.toLowerCase())
          : [...cleanVotes, myName];
        return {
          ...v,
          votes: newVotes
        };
      }
      return v;
    });

    setGroup(prev => ({ ...prev, votes: updatedVotes }));
    broadcastGroupUpdate('votes_sync', updatedVotes);
  };

  const handleAddVoteOption = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVoteCity.trim()) return;
    if (group.votes.some(v => v.city.toLowerCase() === newVoteCity.toLowerCase().trim())) return;

    const myName = settings.userName.replace(/\s*\(You\)$/i, '').trim();
    const updatedVotes = [...group.votes, { city: newVoteCity.trim(), votes: [], proposedBy: myName }];
    setGroup(prev => ({
      ...prev,
      votes: updatedVotes
    }));
    broadcastGroupUpdate('votes_sync', updatedVotes);
    setNewVoteCity('');
  };

  const handleDeleteVoteOption = (city: string) => {
    const option = group.votes.find(v => v.city === city);
    if (!option) return;

    const myName = settings.userName.replace(/\s*\(You\)$/i, '').trim();
    const isHost = group.hostId === 'mem-1';
    const isCreator = !option.proposedBy || option.proposedBy.toLowerCase() === myName.toLowerCase();

    if (!isHost && !isCreator && option.proposedBy) {
      alert("Only the creator of this poll or the group admin can delete it.");
      return;
    }

    if (!confirm(`Are you sure you want to delete the destination option "${city}"?`)) return;

    const updatedVotes = group.votes.filter(v => v.city !== city);
    setGroup(prev => ({
      ...prev,
      votes: updatedVotes
    }));
    broadcastGroupUpdate('votes_sync', updatedVotes);
  };

  const handleAddChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistText.trim()) return;

    const myName = settings.userName.replace(/\s*\(You\)$/i, '').trim();
    const newItem: ChecklistItem = {
      id: generateId(),
      text: newChecklistText.trim(),
      checked: false,
      assigneeName: newChecklistAssignee,
      createdBy: myName
    };

    const updatedChecklist = [...group.checklist, newItem];
    setGroup(prev => ({
      ...prev,
      checklist: updatedChecklist
    }));
    broadcastGroupUpdate('checklist_sync', updatedChecklist);
    setNewChecklistText('');
  };

  const toggleChecklist = (id: string) => {
    const updatedChecklist = group.checklist.map(c => 
      c.id === id ? { ...c, checked: !c.checked } : c
    );
    setGroup(prev => ({ ...prev, checklist: updatedChecklist }));
    broadcastGroupUpdate('checklist_sync', updatedChecklist);
  };

  const handleDeleteChecklist = (id: string) => {
    const item = group.checklist.find(c => c.id === id);
    if (!item) return;

    const myName = settings.userName.replace(/\s*\(You\)$/i, '').trim();
    const isHost = group.hostId === 'mem-1';
    const isCreator = !item.createdBy || item.createdBy.toLowerCase() === myName.toLowerCase();

    if (!isHost && !isCreator && item.createdBy) {
      alert("Only the creator of this task or the group admin can delete it.");
      return;
    }

    const updatedChecklist = group.checklist.filter(c => c.id !== id);
    setGroup(prev => ({ ...prev, checklist: updatedChecklist }));
    broadcastGroupUpdate('checklist_sync', updatedChecklist);
  };

  const handleClearAllRecords = () => {
    if (confirm("Are you sure you want to completely clear all travel records? This will delete all saved itineraries, expenses, active trip, custom settings, and groups, but keep your login session. This action CANNOT be undone.")) {
      // Wiping selectively from local storage
      localStorage.removeItem('trippy_active_trip');
      localStorage.removeItem('trippy_group');
      localStorage.removeItem('trippy_expenses');
      localStorage.removeItem('trippy_safety_report');
      localStorage.removeItem('trippy_chatbot_msgs');
      localStorage.removeItem('trippy_saved_trips');
      localStorage.removeItem('trippy_settings');

      // Keep currentUser and isGuest intact
      setActiveTab('planner');
      
      // Keep username & email from currentUser if logged in, otherwise default settings
      const clearedSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        userName: currentUser ? currentUser.name : DEFAULT_SETTINGS.userName,
        email: currentUser ? currentUser.email || '' : DEFAULT_SETTINGS.email
      };
      setSettings(clearedSettings);
      setTempUserName(clearedSettings.userName);
      setTempUserUpi(clearedSettings.userUpi);
      setTempPersonalInfo(clearedSettings.personalInfo);
      setTempPhone(clearedSettings.phone);
      setTempEmail(clearedSettings.email);
      setTempEmergencyContact(clearedSettings.emergencyContact);

      setActiveTrip(null);
      setSafetyReport(null);
      
      // Clean group depending on guest or registered user
      if (isGuest) {
        setGroup({
          id: 'group-' + generateId(),
          name: 'My Guest Group 🚀',
          members: [{ id: 'mem-1', name: 'Guest (You)', upi: '' }],
          votes: [],
          checklist: [],
          chatHistory: [
            {
              id: 'welcome-' + generateId(),
              sender: 'System',
              text: `Welcome to your guest session group! 👥\n\n(Please register to connect and sync with other travelers)`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ],
          hostId: 'mem-1'
        });
        setExpenses([]);
      } else {
        const freshGroup: Group = {
          id: 'group-' + generateId(),
          name: currentUser ? `${currentUser.name}'s Trip Group 🚀` : 'My Trip Group 🚀',
          members: [
            { id: 'mem-1', name: currentUser ? `${currentUser.name} (You)` : 'Dhruv (You)', upi: '' }
          ],
          votes: [],
          checklist: [],
          chatHistory: [
            {
              id: 'welcome-' + generateId(),
              sender: 'System',
              text: `Welcome to your fresh group! 👥\n\nInvite your friends by generating an invite code above. When they enter the code in their Group Hub, they will join this group!`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ],
          hostId: 'mem-1'
        };
        setGroup(freshGroup);
        setExpenses([]);
      }
      
      setSavedTrips([]);
      setChatbotMessages([
        {
          id: 'welcome',
          sender: 'TripPilot',
          text: `Hi there! I am your AI Travel Companion. 🗺️\n\nGenerate a trip in the **Trip Planner** tab, and I will instantly know the details to help you out!\n\nFeel free to ask me questions like:\n* *"Is UPI accepted widely in Goa?"*\n* *"What is the temple dress code in Jaipur?"*\n* *"How can I cut costs on transport?"*`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isAI: true
        }
      ]);
      setInviteLinkInput('');
      
      alert("All travel records have been cleared successfully! 🗑️");
    }
  };

  const handleCreateIsolatedGroup = () => {
    if (confirm("Are you sure you want to create a fresh isolated group? This will clear the current group members, chat, voting, and expenses, starting a new group with only you.")) {
      const newGroup: Group = {
        id: 'group-' + generateId(),
        name: `${settings.userName}'s Trip Group 🚀`,
        members: [
          { id: 'mem-1', name: `${settings.userName} (You)`, upi: settings.userUpi }
        ],
        votes: [],
        checklist: [],
        chatHistory: [
          {
            id: 'welcome-' + generateId(),
            sender: 'System',
            text: `Welcome to your fresh group! 👥\n\nInvite your friends by generating an invite code above. When they enter the code in their Group Hub, they will join this group!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ],
        hostId: 'mem-1'
      };
      setGroup(newGroup);
      setExpenses([]);
      if (!isGuest) {
        localStorage.setItem('trippy_group', JSON.stringify(newGroup));
        localStorage.setItem('trippy_expenses', JSON.stringify([]));
      }
      alert("Fresh isolated group created successfully! Share the invite code with your friends to connect them.");
    }
  };

  const handleLeaveGroup = () => {
    if (confirm("Are you sure you want to leave this group? This will clear current group data and return you to an isolated group.")) {
      // 1. Broadcast leave event to all peers
      broadcastGroupUpdate('member_leave', { name: settings.userName });

      // 2. Broadcast system chat notification
      const leaveMsg = {
        id: 'sys-' + generateId(),
        sender: 'System',
        text: `${settings.userName} has left the group. 🚪`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      broadcastGroupUpdate('chat', leaveMsg);

      // 3. Reset locally
      const newGroup: Group = {
        id: 'group-' + generateId(),
        name: `${settings.userName}'s Trip Group 🚀`,
        members: [
          { id: 'mem-1', name: `${settings.userName} (You)`, upi: settings.userUpi }
        ],
        votes: [],
        checklist: [],
        chatHistory: [
          {
            id: 'welcome-' + generateId(),
            sender: 'System',
            text: `Welcome to your fresh group! 👥\n\nInvite your friends by generating an invite code above. When they enter the code in their Group Hub, they will join this group!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ],
        hostId: 'mem-1'
      };
      setGroup(newGroup);
      setExpenses([]);
      if (!isGuest) {
        localStorage.setItem('trippy_group', JSON.stringify(newGroup));
        localStorage.setItem('trippy_expenses', JSON.stringify([]));
      }
      alert("You have left the group and returned to an isolated session.");
    }
  };

  const handleSendGroupChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const myMessage: ChatMessage = {
      id: generateId(),
      sender: settings.userName,
      text: chatInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setGroup(prev => ({
      ...prev,
      chatHistory: [...prev.chatHistory, myMessage]
    }));
    setChatInput('');

    // Broadcast message over ntfy
    broadcastGroupUpdate('chat', myMessage);
  };

  // Expense Handlers
  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseTitle.trim() || !expenseAmount || parseFloat(expenseAmount) <= 0) return;

    const newExpense: Expense = {
      id: generateId(),
      title: expenseTitle.trim(),
      amount: parseFloat(expenseAmount),
      paidBy: expensePaidBy,
      splitWith: expenseSplitWith,
      category: expenseCategory,
      date: new Date().toISOString().split('T')[0]
    };

    const updated = [newExpense, ...expenses];
    setExpenses(updated);
    broadcastGroupUpdate('expenses_sync', updated);
    setExpenseTitle('');
    setExpenseAmount('');
    
    // Add chatbot system alert if expense exceeds 80% of budget limit in proportion
    const sumTotal = expenses.reduce((acc, curr) => acc + curr.amount, 0) + parseFloat(expenseAmount);
    if (activeTrip && sumTotal > activeTrip.budgetLimit) {
      setTimeout(() => {
        const warningMsg: ChatMessage = {
          id: generateId(),
          sender: 'TripPilot',
          text: `🚨 **Budget Alert**: Your total group spending (₹${sumTotal}) has exceeded the planned budget limit of **₹${activeTrip.budgetLimit}**! Consider using the **"Over Budget"** replanning trigger in the Trip Planner tab to optimize remaining days.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isAI: true
        };
        setChatbotMessages(prev => [...prev, warningMsg]);
      }, 1000);
    }
  };

  const handleDeleteExpense = (id: string) => {
    const updated = expenses.filter(e => e.id !== id);
    setExpenses(updated);
    broadcastGroupUpdate('expenses_sync', updated);
  };

  // Splitwise Debts Simplified Solver
  const calculateSettlements = () => {
    const balances: { [key: string]: number } = {};
    group.members.forEach(m => {
      balances[m.name] = 0;
    });

    expenses.forEach(exp => {
      const amount = exp.amount;
      const payer = exp.paidBy;
      const splitters = exp.splitWith;

      if (balances[payer] === undefined) balances[payer] = 0;
      balances[payer] += amount;

      const perPerson = amount / Math.max(1, splitters.length);
      splitters.forEach(s => {
        if (balances[s] === undefined) balances[s] = 0;
        balances[s] -= perPerson;
      });
    });

    const creditors: { name: string; amount: number }[] = [];
    const debtors: { name: string; amount: number }[] = [];

    Object.keys(balances).forEach(name => {
      const bal = balances[name];
      if (bal > 0.05) {
        creditors.push({ name, amount: bal });
      } else if (bal < -0.05) {
        debtors.push({ name, amount: -bal });
      }
    });

    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const settlements: { from: string; to: string; amount: number }[] = [];

    let cIdx = 0;
    let dIdx = 0;

    // Deep copy arrays for operations
    const activeCreds = creditors.map(c => ({ ...c }));
    const activeDebts = debtors.map(d => ({ ...d }));

    while (cIdx < activeCreds.length && dIdx < activeDebts.length) {
      const cred = activeCreds[cIdx];
      const debt = activeDebts[dIdx];

      const minAmt = Math.min(cred.amount, debt.amount);
      settlements.push({
        from: debt.name,
        to: cred.name,
        amount: Math.round(minAmt)
      });

      cred.amount -= minAmt;
      debt.amount -= minAmt;

      if (cred.amount <= 0.05) cIdx++;
      if (debt.amount <= 0.05) dIdx++;
    }

    return settlements;
  };

  const settlementsList = calculateSettlements();

  const handleSettleUp = (from: string, to: string, amount: number) => {
    // Inject a settling expense record
    const settlingExpense: Expense = {
      id: generateId(),
      title: `Settlement: ${from} paid ${to}`,
      amount: amount,
      paidBy: from,
      splitWith: [to],
      category: 'emergency',
      date: new Date().toISOString().split('T')[0]
    };

    setExpenses(prev => [settlingExpense, ...prev]);
    setSettlementModal(null);
  };

  // AI Chatbot queries
  const handleSendChatbot = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const query = customQuery || botQuery;
    if (!query.trim()) return;

    const userMsg: ChatMessage = {
      id: generateId(),
      sender: `${settings.userName} (You)`,
      text: query.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatbotMessages(prev => [...prev, userMsg]);
    if (!customQuery) setBotQuery('');
    setBotLoading(true);

    try {
      // Map ChatMessage structure to AIService format
      const history = chatbotMessages
        .filter(m => m.id !== 'welcome')
        .map(m => ({
          role: m.isAI ? 'assistant' : 'user' as 'assistant' | 'user' | 'system',
          content: m.text
        }));

      history.push({ role: 'user', content: query.trim() });

      const profileContext = [
        settings.userName ? `Name: ${settings.userName}` : '',
        settings.email ? `Email: ${settings.email}` : '',
        settings.phone ? `Phone: ${settings.phone}` : '',
        settings.emergencyContact ? `Emergency Contact: ${settings.emergencyContact}` : '',
        settings.personalInfo ? `Preferences/Notes: ${settings.personalInfo}` : ''
      ].filter(Boolean).join('\n');

      const reply = await AIService.askChatbot(
        history, 
        activeTrip, 
        settings.openaiApiKey, 
        settings.model,
        profileContext
      );
      
      const aiMsg: ChatMessage = {
        id: generateId(),
        sender: 'TripPilot',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAI: true
      };

      setChatbotMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: generateId(),
        sender: 'TripPilot',
        text: `❌ Failed to get response: ${(err as Error).message || 'Check your internet connection or OpenAI key.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAI: true
      };
      setChatbotMessages(prev => [...prev, errorMsg]);
    } finally {
      setBotLoading(false);
    }
  };

  // Custom parser to format markdown bold, lists, headers inside AI responses
  const renderFormattedMessageText = (text: string) => {
    return text.split('\n').map((line, idx) => {
      const trimmed = line.trim();
      
      // Header Level 3
      if (trimmed.startsWith('### ')) {
        return <h3 key={idx} style={{ marginTop: '12px', color: 'var(--text-primary)' }}>{trimmed.slice(4)}</h3>;
      }
      // Header Level 2
      if (trimmed.startsWith('## ')) {
        return <h2 key={idx} style={{ marginTop: '16px', color: 'var(--text-primary)', fontSize: '18px' }}>{trimmed.slice(3)}</h2>;
      }
      // List items
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return <li key={idx} style={{ marginLeft: '16px', listStyleType: 'disc', marginBlock: '4px' }}>{parseInlineMarkdown(trimmed.slice(2))}</li>;
      }
      if (/^\d+\.\s/.test(trimmed)) {
        const itemText = trimmed.replace(/^\d+\.\s/, '');
        return <li key={idx} style={{ marginLeft: '16px', listStyleType: 'decimal', marginBlock: '4px' }}>{parseInlineMarkdown(itemText)}</li>;
      }
      
      return <p key={idx} style={{ marginBlock: '6px', minHeight: '1em' }}>{parseInlineMarkdown(line)}</p>;
    });
  };

  const parseInlineMarkdown = (line: string) => {
    // Bold matcher **bold**
    const parts = line.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      // Italic matcher *italic*
      const subParts = part.split(/(\*.*?\*)/g);
      return subParts.map((sub, j) => {
        if (sub.startsWith('*') && sub.endsWith('*')) {
          return <em key={j}>{sub.slice(1, -1)}</em>;
        }
        return sub;
      });
    });
  };

  if (showLanding) {
    return (
      <LandingPage 
        onGetStarted={() => setShowLanding(false)} 
      />
    );
  }

  if (!currentUser && !isGuest) {
    return (
      <Auth 
        onAuthSuccess={handleAuthSuccess} 
        onSkip={() => {
          setIsGuest(true);
          setActiveTab('planner');
        }} 
      />
    );
  }

  return (
    <div className="dashboard-container">
      {/* Sidebar navigation */}
      <aside className="sidebar">
        <div 
          className="brand-section" 
          onClick={() => window.location.reload()}
          style={{ cursor: 'pointer' }}
          title="Reload Page"
        >
          <div className="brand-logo" style={{ background: 'transparent', boxShadow: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img 
              src={logoImg} 
              alt="Trippy Logo" 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
            />
          </div>
          <span className="brand-name">Trippy</span>
        </div>

        {/* Mobile menu toggle */}
        <button 
          className="mobile-menu-toggle"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle Navigation Menu"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <nav className={`sidebar-nav ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
          <ul className="nav-links">
            <li 
              className={`nav-item ${activeTab === 'planner' ? 'active' : ''}`}
              onClick={() => { setActiveTab('planner'); setIsMobileMenuOpen(false); }}
            >
              <MapPin size={18} />
              <span>Trip Planner</span>
            </li>
            <li 
              className={`nav-item ${activeTab === 'safety' ? 'active' : ''}`}
              onClick={() => { setActiveTab('safety'); setIsMobileMenuOpen(false); }}
            >
              <Shield size={18} />
              <span>Safety Center</span>
            </li>
            <li 
              className={`nav-item ${activeTab === 'group' ? 'active' : ''}`}
              onClick={() => { setActiveTab('group'); setIsMobileMenuOpen(false); }}
            >
              <Users size={18} />
              <span>Group Hub</span>
            </li>
            <li 
              className={`nav-item ${activeTab === 'expenses' ? 'active' : ''}`}
              onClick={() => { setActiveTab('expenses'); setIsMobileMenuOpen(false); }}
            >
              <TrendingUp size={18} />
              <span>Expenses</span>
            </li>
            <li 
              className={`nav-item ${activeTab === 'chatbot' ? 'active' : ''}`}
              onClick={() => { setActiveTab('chatbot'); setIsMobileMenuOpen(false); }}
            >
              <MessageSquare size={18} />
              <span>TripPilot AI</span>
            </li>
            <li 
              className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }}
            >
              <SettingsIcon size={18} />
              <span>Settings</span>
            </li>
          </ul>

          {/* Mobile Profile Preview Inside Menu Drawer */}
          <div className="mobile-profile-drawer">
            <div className="avatar">
              {settings.userName.slice(0, 2).toUpperCase()}
            </div>
            <span className="user-name">
              {settings.userName}
            </span>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile-preview" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="avatar">
              {settings.userName.slice(0, 2).toUpperCase()}
            </div>
            <span className="user-name" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {settings.userName}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="main-content">
        
        {/* Notification Permission Bar */}
        {notificationPermission === 'default' && (
          <div 
            className="glass-panel" 
            style={{ 
              margin: '0 0 20px 0', 
              padding: '12px 24px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(6, 182, 212, 0.15))',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '12px',
              animation: 'slideUpFadeIn 0.5s ease-out'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '20px' }}>🔔</span>
              <div>
                <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Enable Live Notifications</strong>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                  Get instant desktop alerts when group members text in chat or log new expenses.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={handleRequestNotificationPermission} 
                className="btn btn-primary btn-sm"
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                Enable
              </button>
              <button 
                onClick={() => setNotificationPermission('denied')} 
                className="btn btn-secondary btn-sm"
                style={{ padding: '6px 10px', fontSize: '12px', background: 'transparent', border: 'none' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Universal Mini Header showing active trip context */}
        {activeTrip ? (
          <div className="glass-panel no-print" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'var(--primary-light)', padding: '10px', borderRadius: '10px', color: 'var(--primary-hover)' }}>
                <MapPin size={20} />
              </div>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: 600 }}>Active Trip to {activeTrip.destination}</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {new Date(activeTrip.startDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} - {new Date(activeTrip.endDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })} • {activeTrip.travelers} Travelers
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Spent vs Budget</span>
                <div style={{ fontWeight: 700, fontFamily: 'var(--font-display)', color: expenses.reduce((acc, curr) => acc + curr.amount, 0) > activeTrip.budgetLimit ? 'var(--danger)' : 'var(--accent)' }}>
                  ₹{expenses.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString('en-IN')} / ₹{activeTrip.budgetLimit.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>
        ) : (
          activeTab !== 'settings' && activeTab !== 'planner' && (
            <div className="settings-warning">
              <AlertTriangle size={18} />
              <span>No active trip generated yet. Switch to the **Trip Planner** to initialize your travel itinerary!</span>
            </div>
          )
        )}

        {/* Tab 1: TRIP PLANNER */}
        {activeTab === 'planner' && (
          <div>
            <div className="panel-header">
              <h1 className="panel-title">🗺️ AI Trip Planner</h1>
              <p className="panel-subtitle">Create optimized, culture-aligned travel plans or adjust them dynamically.</p>
            </div>

            <div className="grid-2col">
              {/* Trip Config Form */}
              <div className="glass-card">
                <h3 style={{ marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>Generate Itinerary</h3>
                <form onSubmit={handleGenerateTrip}>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>From (Source)</label>
                      <input 
                        type="text" 
                        value={source} 
                        onChange={(e) => setSource(e.target.value)} 
                        placeholder="Delhi, Mumbai..." 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>To (Destination)</label>
                      <input 
                        type="text" 
                        value={destination} 
                        onChange={(e) => setDestination(e.target.value)} 
                        placeholder="Goa, Jaipur, Manali..." 
                        required 
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Start Date</label>
                      <input 
                        type="date" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)} 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>End Date</label>
                      <input 
                        type="date" 
                        value={endDate} 
                        onChange={(e) => setEndDate(e.target.value)} 
                        required 
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Travelers count</label>
                      <input 
                        type="number" 
                        min="1" 
                        value={travelers} 
                        onChange={(e) => setTravelers(e.target.value === '' ? '' : parseInt(e.target.value) || '')} 
                        placeholder="e.g. 2"
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>Total Budget Limit (INR)</label>
                      <input 
                        type="number" 
                        min="1000" 
                        step="500" 
                        value={budgetLimit} 
                        onChange={(e) => setBudgetLimit(e.target.value === '' ? '' : parseInt(e.target.value) || '')} 
                        placeholder="e.g. 30000"
                        required 
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Trip Theme</label>
                    <select value={tripType} onChange={(e) => setTripType(e.target.value)}>
                      <option value="Leisure">Leisure / Relaxation 🌴</option>
                      <option value="Adventure">Adventure / Trekking 🧗</option>
                      <option value="Heritage">Heritage / History 🏛️</option>
                      <option value="Backpacking">Budget Backpacking 🎒</option>
                      <option value="Business">Business Trip 💼</option>
                    </select>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Accommodation</label>
                      <select value={accommodationPreference} onChange={(e) => setAccommodationPreference(e.target.value)}>
                        <option value="Luxury">Luxury Resort</option>
                        <option value="Standard">Standard Hotel</option>
                        <option value="Budget">Hostel / HomeStay</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Transport Preference</label>
                      <select value={transportPreference} onChange={(e) => setTransportPreference(e.target.value)}>
                        <option value="flight">Flight ✈️</option>
                        <option value="train">Train 🚂</option>
                        <option value="cab">Rental Cab / Bus 🚗</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Areas of Interest</label>
                    <div className="interests-grid">
                      {INTERESTS_LIST.map(item => (
                        <div 
                          key={item.id} 
                          className={`interest-chip ${selectedInterests.includes(item.id) ? 'selected' : ''}`}
                          onClick={() => toggleInterest(item.id)}
                        >
                          {item.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ width: '100%', marginTop: '12px' }}
                    disabled={loadingTrip}
                  >
                    {loadingTrip ? (
                      <>
                        <RefreshCw className="animate-spin" size={16} />
                        <span>Crafting AI Itinerary...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        <span>Generate Itinerary</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Saved Trips List */}
              {savedTrips.length > 0 && (
                <div className="glass-card" style={{ marginTop: '24px' }}>
                  <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>💾 Saved Itineraries</span>
                    <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary-hover)', fontSize: '11px' }}>
                      {savedTrips.length}
                    </span>
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto' }}>
                    {savedTrips.map(trip => (
                      <div 
                        key={trip.id} 
                        className="saved-trip-item"
                        onClick={() => handleLoadSavedTrip(trip)}
                        style={{ 
                          padding: '12px', 
                          background: activeTrip?.id === trip.id ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255, 255, 255, 0.01)', 
                          border: activeTrip?.id === trip.id ? '1px solid var(--primary-hover)' : '1px solid var(--border)', 
                          borderRadius: '10px', 
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ flexGrow: 1 }}>
                          <strong style={{ fontSize: '13px', display: 'block', color: 'var(--text-primary)' }}>{trip.destination}</strong>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {new Date(trip.startDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} - {new Date(trip.endDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} • {trip.travelers} Pax
                          </span>
                        </div>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          style={{ padding: '4px', minWidth: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)', background: 'transparent', border: 'none' }}
                          onClick={(e) => handleDeleteSavedTrip(trip.id, e)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Itinerary Display Column */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                {!activeTrip ? (
                  <div style={{ textAlign: 'center', margin: 'auto', padding: '24px' }}>
                    <div style={{ background: 'var(--primary-light)', color: 'var(--primary-hover)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                      <MapPin size={32} />
                    </div>
                    <h2>No Itinerary Yet</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px', maxWidth: '320px', marginInline: 'auto' }}>
                      Fill out the form on the left to generate your custom Indian travel schedule.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                      <h3 style={{ margin: 0 }}>Trip Cost Breakdown</h3>
                      <div className="itinerary-actions-bar" style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={handleShareTrip} title="Copy shareable link to clipboard">
                          🔗 Share Link
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={handleSaveTrip} title="Save to My Saved Trips">
                          💾 Save Trip
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => window.print()} title="Print or export as PDF">
                          🖨️ Print / PDF
                        </button>
                      </div>
                    </div>
                    
                    {/* Print-only trip header */}
                    <div className="print-only print-trip-header">
                      <h1 className="print-main-title">✈️ Trippy Travel Itinerary</h1>
                      <div className="print-trip-meta">
                        <div><strong>Destination:</strong> {activeTrip.destination}</div>
                        <div><strong>Source:</strong> {activeTrip.source}</div>
                        <div><strong>Dates:</strong> {new Date(activeTrip.startDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })} - {new Date(activeTrip.endDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</div>
                        <div><strong>Travelers:</strong> {activeTrip.travelers} Pax</div>
                        <div><strong>Theme:</strong> {activeTrip.tripType}</div>
                        <div><strong>Budget Limit:</strong> ₹{activeTrip.budgetLimit.toLocaleString('en-IN')}</div>
                      </div>
                    </div>

                    <h3 className="print-only print-cost-title">Trip Cost Breakdown</h3>
                    
                    {/* SVG / Custom visual progress bar chart */}
                    <div className="budget-visualizer">
                      <div className="budget-bar-container">
                        {Object.entries(activeTrip.costBreakdown).map(([cat, amount]) => {
                          if (cat === 'total') return null;
                          const total = activeTrip.costBreakdown.total;
                          const pct = total > 0 ? (amount / total) * 100 : 0;
                          if (pct <= 0) return null;
                          return (
                            <div 
                              key={cat} 
                              className={`budget-segment bg-${cat}`} 
                              style={{ width: `${pct}%` }} 
                              title={`${cat}: ₹${amount} (${pct.toFixed(1)}%)`}
                            />
                          );
                        })}
                      </div>

                      <div className="legend-grid">
                        {Object.entries(activeTrip.costBreakdown).map(([cat, amount]) => {
                          if (cat === 'total') return null;
                          const pct = (amount / activeTrip.costBreakdown.total) * 100;
                          return (
                            <div key={cat} className="legend-item">
                              <div className={`legend-color bg-${cat}`}></div>
                              <span className="legend-label" style={{ textTransform: 'capitalize' }}>{cat}</span>
                              <span className="legend-value">₹{amount} ({pct.toFixed(0)}%)</span>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span>Total Estimated Cost:</span>
                        <strong style={{ color: 'var(--accent)' }}>₹{activeTrip.costBreakdown.total.toLocaleString('en-IN')}</strong>
                      </div>
                    </div>

                    <h3 style={{ marginBlock: '24px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>Schedule Calendar</span>
                      {replanningDay !== null && <RefreshCw className="animate-spin" size={14} style={{ color: 'var(--primary-hover)' }} />}
                    </h3>

                    {/* Day tabs selection */}
                    <div className="day-selector">
                      {activeTrip.itinerary.map(day => (
                        <div 
                          key={day.dayNumber}
                          className={`day-tab ${activeItineraryDay === day.dayNumber ? 'active' : ''}`}
                          onClick={() => setActiveItineraryDay(day.dayNumber)}
                        >
                          Day {day.dayNumber}
                        </div>
                      ))}
                    </div>

                    {/* Day Itinerary details */}
                    {activeTrip.itinerary.map(day => {
                      const isActive = day.dayNumber === activeItineraryDay;
                      return (
                        <div 
                          key={day.dayNumber} 
                          className={`itinerary-day-section ${isActive ? 'active' : ''}`}
                          style={{ flexGrow: 1, flexDirection: 'column' }}
                        >
                          
                          {/* Replanner Action Trigger Bar */}
                          <div className="replanner-banner">
                            <span className="replanner-text">
                              <strong>Day {day.dayNumber}:</strong> {day.title}
                            </span>
                            <div className="replanner-buttons">
                              <button 
                                className="btn btn-secondary btn-sm" 
                                style={{ background: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}
                                onClick={() => handleReplanning('Sudden heavy rain')}
                                disabled={replanningDay !== null}
                              >
                                🌧️ Rain
                              </button>
                              <button 
                                className="btn btn-secondary btn-sm" 
                                style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }}
                                onClick={() => handleReplanning('Attraction closed for VIP event')}
                                disabled={replanningDay !== null}
                              >
                                🚫 Closed
                              </button>
                              <button 
                                className="btn btn-secondary btn-sm" 
                                style={{ background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' }}
                                onClick={() => handleReplanning('Over budget limit')}
                                disabled={replanningDay !== null}
                              >
                                💸 Over Budget
                              </button>
                              <button 
                                className="btn btn-secondary btn-sm" 
                                style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}
                                onClick={() => handleReplanning('Low energy / tired')}
                                disabled={replanningDay !== null}
                              >
                                🧘 Tired
                              </button>
                            </div>
                          </div>

                          {day.budgetTip && (
                            <div className="glass-panel" style={{ padding: '12px', fontSize: '12px', color: 'var(--warning)', borderColor: 'rgba(245, 158, 11, 0.2)', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                              <span><strong>Budget Tip:</strong> {day.budgetTip}</span>
                            </div>
                          )}

                          {/* Timeline of activities */}
                          <div className="timeline">
                            {day.activities.map((act, idx) => (
                              <div key={idx} className="timeline-item" style={{ borderColor: act.isSafetyWarning ? 'rgba(239, 68, 68, 0.3)' : 'var(--border)' }}>
                                <div className="timeline-dot" style={{ backgroundColor: act.isSafetyWarning ? 'var(--danger)' : 'var(--primary)' }} />
                                <div className="timeline-time">{act.time}</div>
                                <div className="timeline-header">
                                  <span className="timeline-title">
                                    {act.isSafetyWarning && '⚠️ '}
                                    {act.title}
                                  </span>
                                  <span className={`badge badge-${act.type}`}>{act.type}</span>
                                </div>
                                <p className="timeline-desc">{act.description}</p>
                                
                                {/* Rich location/activity details */}
                                {act.address && (
                                  <div className="activity-detail address-detail" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                    <span style={{ opacity: 0.8 }}>📍</span>
                                    <span><strong>Address:</strong> {act.address}</span>
                                  </div>
                                )}
                                
                                {act.durationHours && (
                                  <div className="activity-detail duration-detail" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ opacity: 0.8 }}>🕒</span>
                                    <span><strong>Suggested Stay:</strong> {act.durationHours} {act.durationHours === 1 ? 'hour' : 'hours'}</span>
                                  </div>
                                )}

                                {act.dressCode && (
                                  <div className="activity-detail dress-detail" style={{ fontSize: '12px', color: 'var(--warning)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ opacity: 0.8 }}>👔</span>
                                    <span><strong>Dress Code:</strong> {act.dressCode}</span>
                                  </div>
                                )}

                                {act.highlights && act.highlights.length > 0 && (
                                  <div className="activity-detail highlights-detail" style={{ marginTop: '8px' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Highlights:</span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                      {act.highlights.map((h, i) => (
                                        <span key={i} className="highlight-pill" style={{ fontSize: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-primary)' }}>
                                          ✨ {h}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="timeline-meta" style={{ marginTop: '12px', borderTop: '1px dashed var(--border)', paddingTop: '8px' }}>
                                  <span className="timeline-location">
                                    <MapPin size={12} />
                                    <span className="no-print">
                                      {act.location ? (
                                        <a 
                                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(act.location + ', ' + activeTrip.destination)}`} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="map-link"
                                          title="View on Google Maps"
                                          style={{ color: 'var(--primary-hover)', textDecoration: 'underline', fontWeight: 500 }}
                                        >
                                          {act.location}
                                        </a>
                                      ) : (
                                        <span>Local area</span>
                                      )}
                                    </span>
                                    <span className="print-only">
                                      {act.location || 'Local area'}
                                    </span>
                                  </span>
                                  <span className="timeline-cost" style={{ fontWeight: 600 }}>₹{act.cost}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: SAFETY CENTER */}
        {activeTab === 'safety' && (
          <div>
            <div className="panel-header">
              <h1 className="panel-title">🛡️ Safety Center</h1>
              <p className="panel-subtitle">Get tourist-scam warnings, safety neighborhood ratings, and emergency guides.</p>
            </div>

            {loadingSafety ? (
              <div style={{ textAlign: 'center', padding: '64px' }}>
                <RefreshCw className="animate-spin" size={32} style={{ marginInline: 'auto', marginBottom: '16px', color: 'var(--primary-hover)' }} />
                <h3>Analyzing local safety data...</h3>
              </div>
            ) : safetyReport ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Meter Gauge rating */}
                <div className="glass-card safety-meter">
                  <div className="safety-score-circle" style={{ borderColor: safetyReport.rating > 80 ? 'var(--accent)' : safetyReport.rating > 60 ? 'var(--warning)' : 'var(--danger)' }}>
                    {safetyReport.rating}
                  </div>
                  <div className="safety-description">
                    <span className="safety-label">Destination safety rating</span>
                    <h3 className="safety-status">
                      {safetyReport.rating > 80 ? 'Generally Safe & Welcoming 🟢' : safetyReport.rating > 60 ? 'Moderate Pacing Required 🟡' : 'Exercise High Caution 🔴'}
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      This score is aggregated based on tourist reports, crime registries, scam volume, and female solo travel statistics.
                    </p>
                  </div>
                </div>

                <div className="grid-2col">
                  {/* Common Scams */}
                  <div className="glass-card" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                    <h3 style={{ color: '#f87171', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={18} />
                      <span>Common Tourist Scams</span>
                    </h3>
                    <ul className="safety-bullet-list">
                      {safetyReport.commonScams.map((scam, i) => (
                        <li key={i} className="safety-bullet-item">
                          <span style={{ color: 'var(--danger)' }} className="safety-bullet-icon">🚨</span>
                          <span>{scam}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Neighborhood Guides */}
                  <div className="glass-card">
                    <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MapPin size={18} style={{ color: 'var(--primary-hover)' }} />
                      <span>Neighborhood Guidance</span>
                    </h3>
                    
                    <div style={{ marginBottom: '16px' }}>
                      <strong style={{ color: 'var(--accent)', fontSize: '13px', display: 'block', marginBottom: '8px' }}>🟢 Highly Recommended Safe Hubs:</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {safetyReport.safeNeighborhoods.map((n, i) => (
                          <span key={i} className="badge" style={{ background: 'var(--accent-light)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <strong style={{ color: 'var(--warning)', fontSize: '13px', display: 'block', marginBottom: '8px' }}>🟡 Exercise Caution / Avoid Late-Night:</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {safetyReport.unsafeNeighborhoods.map((n, i) => (
                          <span key={i} className="badge" style={{ background: 'var(--warning-light)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid-2col">
                  {/* Solo Traveler Safety Tips */}
                  <div className="glass-card">
                    <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle size={18} style={{ color: 'var(--primary-hover)' }} />
                      <span>Solo Traveler Tips</span>
                    </h3>
                    <ul className="safety-bullet-list">
                      {safetyReport.soloTravelerTips.map((tip, i) => (
                        <li key={i} className="safety-bullet-item">
                          <span style={{ color: 'var(--primary-hover)' }} className="safety-bullet-icon">✦</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Safety Q&A Accordion */}
                  <div className="glass-card">
                    <h3 style={{ marginBottom: '16px' }}>Local Security Q&A</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {safetyReport.qa.map((item, i) => (
                        <div key={i} style={{ padding: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                          <strong style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'block' }}>Q: {item.question}</strong>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.5 }}>{item.answer}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
                <AlertTriangle size={24} style={{ color: 'var(--warning)', marginBottom: '12px' }} />
                <h3>No Safety Data</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px' }}>
                  Please go to **Trip Planner** and generate a trip first to load specific location safety reviews.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: GROUP HUB */}
        {activeTab === 'group' && (
          <div>
            <div className="panel-header">
              <h1 className="panel-title">👥 Group Coordination Hub</h1>
              <p className="panel-subtitle">Vote on destinations, coordinate check-lists, and message group members.</p>
            </div>

            <div className="grid-2col">
              
              {/* Left Column: Group Members & Destination Voting */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Connect Group Card / Guest Warning */}
                {isGuest ? (
                  <div className="glass-card" style={{ padding: '24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(circle at top right, rgba(234, 67, 53, 0.05), transparent 60%)', zIndex: 0 }}></div>
                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div style={{ display: 'inline-flex', padding: '10px', borderRadius: '50%', background: 'rgba(234, 67, 53, 0.1)', color: '#ea4335', marginBottom: '14px' }}>
                        <Shield size={24} />
                      </div>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Group Sync Locked</h3>
                      <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '18px', maxWidth: '320px', marginLeft: 'auto', marginRight: 'auto' }}>
                        Guests cannot generate invite codes or join synchronized group trips. Create a free account to plan trips with friends.
                      </p>
                      <button 
                        type="button" 
                        className="btn btn-primary btn-sm" 
                        onClick={() => {
                          setIsGuest(false);
                          setCurrentUser(null);
                        }}
                        style={{ padding: '8px 20px' }}
                      >
                        Sign In / Register
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="glass-card">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>🔗 Connect to Group</span>
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', marginTop: '4px' }}>
                      Paste a group invite link or code to join their active trip, checklist, and expenses.
                    </p>
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleConnectInviteLink(inviteLinkInput);
                      }} 
                      style={{ display: 'flex', gap: '8px' }}
                    >
                      <input 
                        type="text" 
                        placeholder="Paste invite link or code..." 
                        value={inviteLinkInput} 
                        onChange={(e) => setInviteLinkInput(e.target.value)} 
                        style={{ 
                          flex: 1, 
                          padding: '8px 12px', 
                          background: 'rgba(8, 9, 12, 0.6)', 
                          border: '1px solid var(--border)', 
                          borderRadius: '8px', 
                          color: 'var(--text-primary)', 
                          fontSize: '13px' 
                        }}
                        required
                      />
                      <button type="submit" className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap' }}>
                        Connect
                      </button>
                    </form>
                  </div>
                )}

                <div className="glass-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                    {isEditingGroupName ? (
                      <form onSubmit={handleSaveGroupName} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexGrow: 1 }}>
                        <input 
                          type="text" 
                          value={tempGroupNameInput} 
                          onChange={(e) => setTempGroupNameInput(e.target.value)} 
                          style={{ padding: '6px 12px', fontSize: '14px', height: '36px', background: 'rgba(8, 9, 12, 0.6)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', width: 'auto', flexGrow: 1 }}
                          required 
                          autoFocus
                        />
                        <button type="submit" className="btn btn-primary btn-sm" style={{ height: '36px' }}>Save</button>
                        <button type="button" className="btn btn-secondary btn-sm" style={{ height: '36px' }} onClick={() => setIsEditingGroupName(false)}>Cancel</button>
                      </form>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ margin: 0 }}>Group Name: {group.name}</h3>
                        <button 
                          type="button" 
                          onClick={() => {
                            setTempGroupNameInput(group.name);
                            setIsEditingGroupName(true);
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                          title="Edit Group Name"
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                    )}
                    <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary-hover)' }}>
                      {group.members.length} Members
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px', width: '100%' }}>
                    {!isGuest && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          onClick={handleShareGroupCode}
                          disabled={sharingGroup}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                          title="Generate a 9-character code to share this group, itinerary, checklist, and expenses with friends"
                        >
                          {sharingGroup ? (
                            <>
                              <RefreshCw size={14} className="animate-spin" style={{ marginRight: '6px' }} />
                              <span>Generating Invite Code...</span>
                            </>
                          ) : (
                            <>
                              <span>🔗 Generate & Copy Invite Code</span>
                            </>
                          )}
                        </button>
                        
                        {generatedGroupCode && (
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between', 
                            padding: '8px 12px', 
                            background: 'rgba(52, 168, 83, 0.1)', 
                            border: '1px solid rgba(52, 168, 83, 0.3)', 
                            borderRadius: '8px',
                            marginTop: '2px'
                          }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Active Invite Code:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <code style={{ 
                                fontSize: '13px', 
                                fontWeight: 'bold', 
                                color: 'var(--primary-hover)',
                                letterSpacing: '1px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}>{generatedGroupCode}</code>
                              <button 
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '2px 8px', fontSize: '11px', height: 'auto' }}
                                onClick={() => {
                                  navigator.clipboard.writeText(generatedGroupCode);
                                  alert('Invite code copied to clipboard!');
                                }}
                              >
                                Copy
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {(!group.hostId || group.hostId === 'mem-1') ? (
                      <button 
                        type="button"
                        className="btn btn-danger btn-sm" 
                        onClick={handleCreateIsolatedGroup}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%' }}
                        title="Start a fresh group with only you as a member, clearing current group states"
                      >
                        <span>✨ Fresh Group</span>
                      </button>
                    ) : (
                      <button 
                        type="button"
                        className="btn btn-danger btn-sm" 
                        onClick={handleLeaveGroup}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%' }}
                        title="Leave this shared group and start an isolated session"
                      >
                        <span>🚪 Leave Group</span>
                      </button>
                    )}
                  </div>

                  <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px', listStyle: 'none', marginBottom: '16px' }}>
                    {group.members.map(member => {
                      const isLocalAdmin = !group.hostId || group.hostId === 'mem-1';
                      const isThisMemberAdmin = (!group.hostId && member.id === 'mem-1') || (group.hostId && (member.id === group.hostId || (group.hostId === 'mem-1' && member.id === 'mem-1')));
                      
                      return (
                        <li 
                          key={member.id} 
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '8px' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div className="avatar" style={{ width: '28px', height: '28px', fontSize: '11px' }}>
                              {member.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <strong style={{ fontSize: '13px' }}>{member.name}</strong>
                              {isThisMemberAdmin && (
                                <span style={{ fontSize: '10px', color: 'var(--primary)', background: 'rgba(139, 92, 246, 0.1)', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>Admin 👑</span>
                              )}
                              {member.upi && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>({member.upi})</span>}
                            </div>
                          </div>
                          {isLocalAdmin && member.id !== 'mem-1' && (
                            <button 
                              className="btn btn-secondary btn-sm" 
                              style={{ padding: '4px', minWidth: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              onClick={() => handleRemoveMember(member.id)}
                              title="Remove member from group"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  <form onSubmit={handleAddMember} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <input 
                      type="text" 
                      placeholder="Name" 
                      value={newMemberName} 
                      onChange={(e) => setNewMemberName(e.target.value)} 
                      style={{ flex: 1, minWidth: '100px' }}
                    />
                    <input 
                      type="text" 
                      placeholder="UPI (optional)" 
                      value={newMemberUpi} 
                      onChange={(e) => setNewMemberUpi(e.target.value)} 
                      style={{ flex: 1, minWidth: '120px' }}
                    />
                    <button type="submit" className="btn btn-primary btn-sm">
                      <Plus size={14} />
                      <span>Add</span>
                    </button>
                  </form>
                </div>

                {/* Destination Voting */}
                <div className="glass-card">
                  <h3>Destination Voting</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', marginTop: '4px' }}>
                    Propose vacation spots and vote collectively.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                    {group.votes.map((v, i) => (
                      <div key={i} className="vote-card">
                        <div>
                          <strong style={{ fontSize: '14px' }}>{v.city}</strong>
                          <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                            {v.votes.map((idOrName, idx) => {
                              let name = idOrName;
                              if (idOrName === 'mem-1' || (currentUser && idOrName === currentUser.id)) {
                                name = settings.userName;
                              } else {
                                const found = group.members.find(m => m.id === idOrName);
                                if (found) {
                                  name = found.name;
                                }
                              }
                              let cleanName = name.replace(/\s*\(You\)$/i, '').trim();
                              // Fallback to 'Someone' if it's an unresolved ID format
                              if (/^(mem-|g-|a-)/i.test(cleanName)) {
                                cleanName = 'Someone';
                              }
                              const isMe = cleanName.toLowerCase() === settings.userName.trim().toLowerCase();
                              const displayName = isMe ? `${settings.userName} (You)` : cleanName;

                              return (
                                <span key={idx} style={{ fontSize: '9px', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                                  {displayName.split(' ')[0]}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <div className="vote-actions">
                          <span className="votes-count">{v.votes.length} Votes</span>
                          <button 
                            className={`btn btn-sm ${v.votes.some(val => {
                              let name = val;
                              if (val === 'mem-1' || (currentUser && val === currentUser.id)) {
                                name = settings.userName;
                              } else {
                                const found = group.members.find(m => m.id === val);
                                if (found) {
                                  name = found.name;
                                }
                              }
                              return name.replace(/\s*\(You\)$/i, '').trim().toLowerCase() === settings.userName.trim().toLowerCase();
                            }) ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => handleVote(v.city)}
                          >
                            Vote
                          </button>
                          {(() => {
                            const myName = settings.userName.replace(/\s*\(You\)$/i, '').trim();
                            const isHost = group.hostId === 'mem-1';
                            const isCreator = !v.proposedBy || v.proposedBy.toLowerCase() === myName.toLowerCase();
                            return (isHost || isCreator) && (
                              <button 
                                className="btn btn-secondary btn-sm" 
                                style={{ padding: '4px', minWidth: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                onClick={() => handleDeleteVoteOption(v.city)}
                                title="Delete destination option"
                              >
                                <Trash2 size={12} />
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddVoteOption} style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      placeholder="Add destination..." 
                      value={newVoteCity} 
                      onChange={(e) => setNewVoteCity(e.target.value)} 
                    />
                    <button type="submit" className="btn btn-primary btn-sm">
                      Propose
                    </button>
                  </form>
                </div>

              </div>

              {/* Right Column: Group checklist & Chat */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Collaborative packing checklist */}
                <div className="glass-card">
                  <h3>Collaborative Checklist</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', marginTop: '4px' }}>
                    Coordinate items checklist with assignees.
                  </p>

                  <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '16px' }}>
                    {group.checklist.map(item => (
                      <div key={item.id} className={`checklist-item ${item.checked ? 'checked' : ''}`}>
                        <div 
                          className={`checkbox-custom ${item.checked ? 'checked' : ''}`}
                          onClick={() => toggleChecklist(item.id)}
                        >
                          {item.checked && <Check size={12} />}
                        </div>
                        <div style={{ flexGrow: 1 }}>
                          <span style={{ fontSize: '13px' }}>{item.text}</span>
                          {item.assigneeName && (
                            <span style={{ fontSize: '10px', color: 'var(--primary-hover)', display: 'block', marginTop: '2px' }}>
                              Assignee: {item.assigneeName}
                            </span>
                          )}
                        </div>
                        {(() => {
                          const myName = settings.userName.replace(/\s*\(You\)$/i, '').trim();
                          const isHost = group.hostId === 'mem-1';
                          const isCreator = !item.createdBy || item.createdBy.toLowerCase() === myName.toLowerCase();
                          return (isHost || isCreator) && (
                            <button 
                              className="btn btn-secondary btn-sm" 
                              style={{ padding: '4px', minWidth: '24px', height: '24px' }}
                              onClick={() => handleDeleteChecklist(item.id)}
                            >
                              <Trash2 size={12} />
                            </button>
                          );
                        })()}
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddChecklist} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <input 
                      type="text" 
                      placeholder="Task item name..." 
                      value={newChecklistText} 
                      onChange={(e) => setNewChecklistText(e.target.value)} 
                      style={{ flex: 1, minWidth: '130px' }}
                    />
                    <select 
                      value={newChecklistAssignee} 
                      onChange={(e) => setNewChecklistAssignee(e.target.value)}
                      style={{ width: '130px' }}
                    >
                      {group.members.map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                    <button type="submit" className="btn btn-primary btn-sm">
                      Add Task
                    </button>
                  </form>
                </div>

                {/* Group Chat Room */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <h3>Group Live Chat</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', marginTop: '4px' }}>
                    Brainstorm with peers and coordinate plans in real-time.
                  </p>

                  <div className="chat-container" style={{ height: '250px' }}>
                    <div className="chat-history">
                      {group.chatHistory.map(msg => {
                        const cleanSender = msg.sender.replace(/\s*\(You\)$/i, '').trim();
                        const isMe = cleanSender.toLowerCase() === settings.userName.trim().toLowerCase() || msg.sender.includes('(You)');
                        const isSystem = msg.sender === 'System';
                        
                        let msgClass = 'chat-msg-ai';
                        let senderColor = 'var(--primary-hover)';
                        let displayName = cleanSender;

                        if (isMe) {
                          msgClass = 'chat-msg-user';
                          senderColor = 'rgba(255,255,255,0.8)';
                          displayName = `${settings.userName} (You)`;
                        } else if (isSystem) {
                          msgClass = 'chat-msg-system';
                          senderColor = 'var(--warning)';
                          displayName = 'System';
                        }

                        return (
                          <div 
                            key={msg.id} 
                            className={`chat-msg ${msgClass}`}
                            style={{ 
                              maxWidth: '85%',
                              alignSelf: isMe ? 'flex-end' : (isSystem ? 'center' : 'flex-start'),
                              background: isSystem ? 'rgba(255, 193, 7, 0.05)' : undefined,
                              border: isSystem ? '1px dashed rgba(255, 193, 7, 0.2)' : undefined,
                              textAlign: isSystem ? 'center' : 'left',
                              padding: isSystem ? '6px 12px' : undefined,
                              borderRadius: isSystem ? '8px' : undefined,
                              margin: isSystem ? '8px auto' : undefined
                            }}
                          >
                            {!isSystem && (
                              <div style={{ fontSize: '11px', fontWeight: 600, color: senderColor, marginBottom: '2px' }}>
                                {displayName}
                              </div>
                            )}
                            <div>{msg.text}</div>
                            <div className="chat-msg-time">{msg.timestamp}</div>
                          </div>
                        );
                      })}
                      <div ref={groupChatEndRef} />
                    </div>

                    <form onSubmit={handleSendGroupChat} className="chat-input-area">
                      <input 
                        type="text" 
                        placeholder="Message group..." 
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                      />
                      <button type="submit" className="btn btn-primary" style={{ padding: '12px' }}>
                        <Send size={16} />
                      </button>
                    </form>
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}

        {/* Tab 4: EXPENSES */}
        {activeTab === 'expenses' && (
          <div>
            <div className="panel-header">
              <h1 className="panel-title">💸 Expense Splitter</h1>
              <p className="panel-subtitle">Record common expenses, divide split shares, and simplify final debts (Splitwise style).</p>
            </div>

            <div className="grid-2col">
              
              {/* Add & Settle Up Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Balance & Debt Settlements Sheet */}
                <div className="glass-card">
                  <h3>Debts Settlement Summary</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', marginTop: '4px' }}>
                    Simplified balance sheets. Click UPI button to pay or mark settled.
                  </p>

                  {settlementsList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px', color: 'var(--accent)' }}>
                      🎉 All group expenses are fully settled up!
                    </div>
                  ) : (
                    <div className="settlement-card">
                      <div className="settlement-title">
                        <TrendingUp size={16} />
                        <span>Active Dues to Clear</span>
                      </div>
                      <ul className="settlement-list">
                        {settlementsList.map((s, idx) => {
                          const toMember = group.members.find(m => m.name === s.to);
                          return (
                            <li key={idx} className="settlement-item">
                              <span>
                                <strong>{s.from}</strong> owes <strong>{s.to}</strong>:
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>₹{s.amount.toLocaleString('en-IN')}</span>
                                {toMember?.upi ? (
                                  <button 
                                    className="upi-pay-btn"
                                    onClick={() => setSettlementModal(s)}
                                  >
                                    Pay UPI
                                  </button>
                                ) : (
                                  <button 
                                    className="btn btn-secondary btn-sm"
                                    style={{ padding: '2px 6px', fontSize: '10px' }}
                                    onClick={() => handleSettleUp(s.from, s.to, s.amount)}
                                  >
                                    Mark Settled
                                  </button>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Add Expense Form */}
                <div className="glass-card">
                  <h3>Add New Expense</h3>
                  <form onSubmit={handleAddExpense} style={{ marginTop: '16px' }}>
                    <div className="form-group">
                      <label>Expense Title / Description</label>
                      <input 
                        type="text" 
                        value={expenseTitle} 
                        onChange={(e) => setExpenseTitle(e.target.value)} 
                        placeholder="e.g. Flight tickets, Dinner, Taxi rental..." 
                        required 
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Amount (₹ INR)</label>
                        <input 
                          type="number" 
                          min="1" 
                          value={expenseAmount} 
                          onChange={(e) => setExpenseAmount(e.target.value)} 
                          placeholder="Amount in Rupees" 
                          required 
                        />
                      </div>
                      <div className="form-group">
                        <label>Paid By</label>
                        <select 
                          value={expensePaidBy} 
                          onChange={(e) => setExpensePaidBy(e.target.value)}
                        >
                          {group.members.map(m => (
                            <option key={m.id} value={m.name}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Category</label>
                      <select 
                        value={expenseCategory} 
                        onChange={(e) => setExpenseCategory(e.target.value as Expense['category'])}
                      >
                        <option value="accommodation">Accommodation 🏨</option>
                        <option value="transport">Transport / Fuel 🚗</option>
                        <option value="food">Food & Diners 🍛</option>
                        <option value="sightseeing">Sightseeing 🏛️</option>
                        <option value="shopping">Shopping 🛍️</option>
                        <option value="emergency">Emergency / Other 🚨</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Split With (Check all that apply)</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
                        {group.members.map(m => (
                          <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'none', fontSize: '13px', cursor: 'pointer' }}>
                            <input 
                              type="checkbox" 
                              checked={expenseSplitWith.includes(m.name)}
                              style={{ width: 'auto' }}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setExpenseSplitWith(prev => [...prev, m.name]);
                                } else {
                                  setExpenseSplitWith(prev => prev.filter(name => name !== m.name));
                                }
                              }}
                            />
                            <span>{m.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
                      Add Expense Record
                    </button>
                  </form>
                </div>

              </div>

              {/* Expense Ledger Column */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3>Expense Ledger History</h3>
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)' }}>
                    Total: ₹{expenses.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <div style={{ overflowY: 'auto', flexGrow: 1, maxHeight: '520px' }}>
                  {expenses.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                      No expenses recorded yet.
                    </div>
                  ) : (
                    expenses.map(exp => (
                      <div key={exp.id} className="expense-item">
                        <div className="expense-info">
                          <span className="expense-title">{exp.title}</span>
                          <span className="expense-details">
                            Paid by <strong>{exp.paidBy}</strong> • Split with {exp.splitWith.length} people
                          </span>
                          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                            <span className="badge" style={{ fontSize: '9px', padding: '2px 6px' }}>{exp.date}</span>
                            <span className={`badge badge-${exp.category}`} style={{ fontSize: '9px', padding: '2px 6px' }}>{exp.category}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span className="expense-amount">₹{exp.amount.toLocaleString('en-IN')}</span>
                          <button 
                            className="btn btn-secondary btn-sm" 
                            style={{ padding: '4px', minWidth: '24px', height: '24px' }}
                            onClick={() => handleDeleteExpense(exp.id)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Tab 5: TRIP COMPANION CHATBOT */}
        {activeTab === 'chatbot' && (
          <div>
            <div className="panel-header">
              <h1 className="panel-title">💬 TripPilot AI Assistant</h1>
              <p className="panel-subtitle">Chat with a travel planner assistant. It knows your destination, dates, and settings.</p>
            </div>

            <div className="glass-card" style={{ padding: 0 }}>
              <div className="chat-container">
                
                {/* Chat Message Box */}
                <div className="chat-history">
                  {chatbotMessages.map(msg => (
                    <div 
                      key={msg.id} 
                      className={`chat-msg ${msg.isAI ? 'chat-msg-ai' : 'chat-msg-user'}`}
                    >
                      <strong style={{ fontSize: '11px', display: 'block', marginBottom: '4px', color: msg.isAI ? 'var(--primary-hover)' : 'rgba(255, 255, 255, 0.8)' }}>
                        {msg.sender}
                      </strong>
                      <div style={{ whiteSpace: 'pre-wrap' }}>
                        {msg.isAI ? renderFormattedMessageText(msg.text) : msg.text}
                      </div>
                      <div className="chat-msg-time">{msg.timestamp}</div>
                    </div>
                  ))}
                  
                  {botLoading && (
                    <div className="chat-msg chat-msg-ai">
                      <strong style={{ fontSize: '11px', display: 'block', color: 'var(--primary-hover)' }}>TripPilot</strong>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', height: '20px' }}>
                        <span className="dot animate-pulse">●</span>
                        <span className="dot animate-pulse" style={{ animationDelay: '0.2s' }}>●</span>
                        <span className="dot animate-pulse" style={{ animationDelay: '0.4s' }}>●</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Quick Chips suggestions */}
                <div className="chat-chips">
                  <div className="chat-chip" onClick={() => handleSendChatbot(undefined, "Is UPI accepted widely here?")}>
                    💳 UPI acceptance?
                  </div>
                  <div className="chat-chip" onClick={() => handleSendChatbot(undefined, "What is the temple dress code?")}>
                    🛕 Temple dress code?
                  </div>
                  <div className="chat-chip" onClick={() => handleSendChatbot(undefined, "What are tipping standards?")}>
                    🪙 Tipping guidelines?
                  </div>
                  {activeTrip && (
                    <div className="chat-chip" onClick={() => handleSendChatbot(undefined, `How can I save costs on my ₹${activeTrip.budgetLimit} budget?`)}>
                      💸 Budget tips
                    </div>
                  )}
                </div>

                {/* Input form */}
                <form onSubmit={(e) => handleSendChatbot(e)} className="chat-input-area">
                  <input 
                    type="text" 
                    placeholder="Ask TripPilot travel questions..." 
                    value={botQuery}
                    onChange={(e) => setBotQuery(e.target.value)}
                    disabled={botLoading}
                  />
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ padding: '12px' }}
                    disabled={botLoading}
                  >
                    <Send size={16} />
                  </button>
                </form>

              </div>
            </div>
          </div>
        )}

        {/* Tab 6: SETTINGS */}
        {activeTab === 'settings' && (
          <div>
            <div className="panel-header">
              <h1 className="panel-title">⚙️ App Settings</h1>
              <p className="panel-subtitle">Customize your traveler profile, UPI details for expense settlements, and preferences.</p>
            </div>

            <div className="grid-2col">
              
              {/* Profile & Payments Settings Card */}
              <div className="glass-card">
                <h3>Profile & Payments</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '20px', marginTop: '4px' }}>
                  Configure your display name and UPI ID for simplified expense splitting.
                </p>

                <form onSubmit={handleSaveSettings}>
                  <div className="form-group">
                    <label>Your Name</label>
                    <input 
                      type="text" 
                      value={tempUserName} 
                      onChange={(e) => setTempUserName(e.target.value)} 
                      placeholder="Dhruv" 
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label>Your UPI ID</label>
                    <input 
                      type="text" 
                      value={tempUserUpi} 
                      onChange={(e) => setTempUserUpi(e.target.value)} 
                      placeholder="username@upi" 
                    />
                  </div>

                  <div className="form-group">
                    <label>Email Address</label>
                    <input 
                      type="email" 
                      value={tempEmail} 
                      onChange={(e) => setTempEmail(e.target.value)} 
                      placeholder="dhruv@example.com" 
                    />
                  </div>

                  <div className="form-group">
                    <label>Phone Number</label>
                    <input 
                      type="tel" 
                      value={tempPhone} 
                      onChange={(e) => setTempPhone(e.target.value)} 
                      placeholder="+91 XXXXX XXXXX" 
                    />
                  </div>

                  <div className="form-group">
                    <label>Emergency Contact Info</label>
                    <input 
                      type="text" 
                      value={tempEmergencyContact} 
                      onChange={(e) => setTempEmergencyContact(e.target.value)} 
                      placeholder="e.g. Aarav (Brother): +91 98765 43210" 
                    />
                  </div>

                  <div className="form-group">
                    <label>Personal Preferences / Medical Notes</label>
                    <textarea 
                      value={tempPersonalInfo} 
                      onChange={(e) => setTempPersonalInfo(e.target.value)} 
                      placeholder="e.g. Vegetarian, A+ blood group, allergic to peanuts"
                      rows={3}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
                    Save Profile Settings
                  </button>
                </form>
              </div>

              {/* Tips & Instructions Card */}
              <div className="glass-card">
                <h3>Getting Started Instructions</h3>
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                  
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ fontSize: '16px' }}>👤</span>
                    <div>
                      <strong>Traveler Profile:</strong> Your name is used across the Group Coordination Hub and Checklist to automatically assign tasks and track your contributions.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ fontSize: '16px' }}>💳</span>
                    <div>
                      <strong>UPI Settlements:</strong> Saving your UPI ID enables other members to pay you back directly using dynamically generated QR codes and deep links.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ fontSize: '16px' }}>💬</span>
                    <div>
                      <strong>AI Companion:</strong> Chatting with the AI companion automatically includes data about your current generated trip, keeping it context-aware of your destination, budget, and travel dates.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ fontSize: '16px' }}>💸</span>
                    <div>
                      <strong>Splitwise Ledger:</strong> Adding group expenses dynamically calculates the net dues for settlements, helping keep your group trip budget on track.
                    </div>
                  </div>

                </div>
              </div>

              {/* Danger Zone Card */}
              <div className="glass-card" style={{ borderColor: 'rgba(239, 68, 68, 0.2)', marginTop: '24px' }}>
                <h3 style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={18} />
                  <span>Danger Zone</span>
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', marginTop: '4px' }}>
                  Manage your account session or reset local data.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button 
                    onClick={handleLogout} 
                    className="btn btn-secondary btn-sm" 
                    style={{ width: '100%', borderColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }}
                  >
                    <LogOut size={14} />
                    <span>Log Out Account</span>
                  </button>
                  <button 
                    onClick={handleClearAllRecords} 
                    className="btn btn-danger btn-sm" 
                    style={{ width: '100%' }}
                  >
                    🗑️ Clear All Records & Reset
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* UPI QR Payment Modal */}
      {settlementModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="glass-panel" style={{ background: 'var(--bg-surface)', padding: '28px', maxWidth: '380px', width: '100%', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h3 style={{ textAlign: 'center', color: 'var(--accent)' }}>💳 UPI Payment Settlement</h3>
            
            <p style={{ fontSize: '13px', textAlign: 'center', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Scan the mock QR code or click pay to settle <strong>₹{settlementModal.amount.toLocaleString('en-IN')}</strong> from <strong>{settlementModal.from}</strong> to <strong>{settlementModal.to}</strong>.
            </p>

            {/* Fake QR code representation */}
            <div style={{ alignSelf: 'center', background: 'white', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '160px', height: '160px', border: '8px double #111319', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', background: '#eee' }}>
                {/* Visual blocks */}
                <div style={{ background: '#111319' }}></div><div style={{ background: '#111319' }}></div><div></div><div style={{ background: '#111319' }}></div>
                <div></div><div style={{ background: '#111319' }}></div><div style={{ background: '#111319' }}></div><div></div>
                <div style={{ background: '#111319' }}></div><div></div><div style={{ background: '#111319' }}></div><div style={{ background: '#111319' }}></div>
                <div style={{ background: '#111319' }}></div><div style={{ background: '#111319' }}></div><div></div><div style={{ background: '#111319' }}></div>
              </div>
              <span style={{ fontSize: '10px', color: '#666', fontWeight: 600 }}>
                {group.members.find(m => m.name === settlementModal.to)?.upi || 'UPI Direct ID'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Deep Link to UPI */}
              <a 
                href={`upi://pay?pa=${group.members.find(m => m.name === settlementModal.to)?.upi}&pn=${encodeURIComponent(settlementModal.to)}&am=${settlementModal.amount}&tn=Trippy%20Settlement&cu=INR`}
                className="btn btn-primary"
                style={{ textAlign: 'center' }}
                onClick={() => {
                  handleSettleUp(settlementModal.from, settlementModal.to, settlementModal.amount);
                }}
              >
                Pay via UPI App Link
              </a>
              <button 
                className="btn btn-secondary"
                onClick={() => setSettlementModal(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
