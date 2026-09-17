'use client';

import { useState, useEffect } from 'react';
import { User, Shield, UserPlus, MoreVertical, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { motion } from 'framer-motion';
import { AmbientBackground } from '@/components/ui/AmbientBackground';

export default function UserManagerPage() {
  const { t } = useLanguage();

  interface User {
      id: string;
      username: string;
      role: string;
      status: string;
      lastLogin: string;
  }

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newUser, setNewUser] = useState({ id: '', username: '', password: '', role: 'Staff', allowedBranches: ['*'] as string[] });
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  async function fetchUsers() {
      try {
          const res = await fetch('/api/admin/users');
          const data = await res.json();
          setUsers(data);
      } catch (err) {
          console.error(err);
      } finally {
          setLoading(false);
      }
  }

  useEffect(() => {
    fetchUsers();
    fetchBranches();
  }, []);

  const [branches, setBranches] = useState<any[]>([]);
  async function fetchBranches() {
      try {
          const res = await fetch('/api/branches');
          const data = await res.json();
          if (Array.isArray(data)) setBranches(data);
      } catch (e) { console.error(e); }
  }

  const toggleBranch = (branchId: string) => {
      const current = newUser.allowedBranches || ['*'];
      let updated;
      
      if (branchId === '*') {
          // สลับเปิด/ปิด "ทุกสาขา" — ปิดแล้วเคลียร์เป็นว่างเพื่อให้เลือกสาขาเฉพาะได้
          updated = current.includes('*') ? [] : ['*'];
      } else {
          let clean = current.includes('*') ? [] : [...current];
          if (clean.includes(branchId)) {
              clean = clean.filter(id => id !== branchId);
          } else {
              clean.push(branchId);
          }
          updated = clean; // อนุญาตว่างระหว่างเลือก (coerce เป็น ['*'] ตอนบันทึกถ้ายังว่าง)
      }
      setNewUser({ ...newUser, allowedBranches: updated });
  };

  const handleAddUser = async () => {
      if(!newUser.username || (!isEditing && !newUser.password)) return;

      // ถ้าไม่ได้เลือกสาขาเลย = ให้ทุกสาขา (กันบัญชีถูกล็อกไม่เห็นสาขาไหนเลย)
      const safeUser = {
        ...newUser,
        allowedBranches: (newUser.allowedBranches && newUser.allowedBranches.length > 0) ? newUser.allowedBranches : ['*'],
      };
      const payload = isEditing
        ? { action: 'update', id: safeUser.id, data: safeUser }
        : { action: 'add', data: safeUser };

      await fetch('/api/admin/users', {
          method: 'POST', // Using POST for both based on existing pattern, usually PUT is better but keeping consistent
          body: JSON.stringify(payload)
      });
      setShowModal(false);
      setNewUser({ id: '', username: '', password: '', role: 'Staff', allowedBranches: ['*'] });
      setIsEditing(false);
      fetchUsers();
  };

  const handleEditUser = (user: any) => {
      setNewUser({ 
          id: user.id,
          username: user.username, 
          password: '', // Don't prefill password
          role: user.role, 
          allowedBranches: user.allowedBranches || ['*'] 
      });
      setIsEditing(true);
      setShowModal(true);
      setActiveMenu(null);
  };

  const handleDeleteUser = async (userId: string) => {
      if(!confirm(t('confirm_delete_user'))) return;
      await fetch('/api/admin/users', {
          method: 'DELETE',
          body: JSON.stringify({ id: userId })
      });
      fetchUsers();
      setActiveMenu(null); // Close menu
  };

  // Close menu on click outside (simple version: click anywhere else closes it IF we had a global listener, 
  // currently simplified to manual close or close on action)

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'Super Admin':
        return { text: '👑 Super Admin (ทุกสาขา)', cls: 'border-purple-300 text-purple-700 bg-purple-500/10' };
      case 'Admin':
        return { text: '💻 แอดมินสาขา (Admin)', cls: 'border-blue-300 text-blue-700 bg-blue-500/10' };
      case 'Manager':
        return { text: '👔 หัวหน้าคลัง (Manager)', cls: 'border-indigo-300 text-indigo-700 bg-indigo-500/10' };
      case 'Staff - Inbound':
        return { text: '📥 แผนกรับเข้า (Inbound)', cls: 'border-emerald-300 text-emerald-700 bg-emerald-500/10' };
      case 'Staff - Picker':
        return { text: '🛒 แผนกหยิบสินค้า (Picker)', cls: 'border-sky-300 text-sky-700 bg-sky-500/10' };
      case 'Staff - QC & Pack':
        return { text: '🔍 แผนกตรวจ QC & แพ็ก', cls: 'border-teal-300 text-teal-700 bg-teal-500/10' };
      case 'Staff - Dispatch':
        return { text: '🚚 แผนกจัดส่ง & ขนส่ง', cls: 'border-orange-300 text-orange-700 bg-orange-500/10' };
      case 'Staff - Inventory':
        return { text: '📋 แผนกตรวจนับ (Inventory)', cls: 'border-amber-300 text-amber-700 bg-amber-500/10' };
      case 'Staff':
      case 'User':
        return { text: '📱 พนักงานคลังทั่วไป (Staff)', cls: 'border-amber-300 text-amber-700 bg-amber-500/10' };
      case 'Viewer':
        return { text: '👁️ ผู้ตรวจสอบ (Viewer)', cls: 'border-[#30353d] text-[#d1c6ab] bg-[#252a32]' };
      default:
        return { text: role, cls: 'border-[#30353d] text-[#d1c6ab] bg-[#1b2027]' };
    }
  };

  return (
    <div className="p-8 pb-32 max-w-6xl mx-auto min-h-screen relative">
      <AmbientBackground />
      
      <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 bg-[#171c23] backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/50 shadow-xl shadow-blue-500/5 relative overflow-hidden"
      >
         <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-700 via-cyan-500 to-emerald-500" />
         
         <div className="relative z-10 flex items-center gap-6">
             <Link
              href="/admin"
              className="p-4 bg-[#171c23] border border-[#30353d] rounded-2xl text-[#8a92a6] hover:text-blue-600 hover:shadow-lg hover:-translate-x-1 transition-all"
             >
              <ArrowLeft className="w-6 h-6" />
             </Link>
             <div>
                 <h1 className="text-4xl font-black text-[#dee2ec] tracking-tight flex items-center gap-4">
                     <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-3 rounded-2xl shadow-lg shadow-blue-200">
                       <Shield className="w-8 h-8" />
                     </div>
                     {t('admin_users_title')}
                 </h1>
                 <p className="text-[#8a92a6] font-medium text-lg ml-2 mt-1">{t('admin_users_subtitle')}</p>
             </div>
         </div>
         
         <button 
             onClick={() => {
                setNewUser({ id: '', username: '', password: '', role: 'Staff - Picker', allowedBranches: ['*'] });
                setIsEditing(false);
                setShowModal(true);
             }}
             className="relative z-10 bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-2xl hover:shadow-blue-500/40 text-white px-8 py-4 rounded-2xl flex items-center gap-3 font-bold transition-all hover:scale-105 active:scale-95"
         >
            <UserPlus className="w-6 h-6" />
            {t('add_user')}
         </button>
      </motion.div>

      <div className="bg-[#171c23] border border-[#30353d] rounded-2xl overflow-visible shadow-xl shadow-slate-900/5 backdrop-blur-xl">
        <table className="w-full text-left text-[#d1c6ab]">
          <thead className="text-white uppercase font-black text-[10px] tracking-[0.1em] sticky top-0 z-20">
            <tr className="bg-gradient-to-r from-blue-600 to-indigo-700 shadow-md">
              <th className="px-6 py-5 rounded-l-2xl">{t('user_info')}</th>
              <th className="px-6 py-5">{t('role')}</th>
              <th className="px-6 py-5">{t('col_status')}</th>
              <th className="px-6 py-5">{t('last_login')}</th>
              <th className="px-6 py-5 text-right rounded-r-2xl">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#30353d]">
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-[#8a92a6] bg-[#1b2027]">{t('processing')}</td></tr>
            ) : users.map((user) => (
              <tr key={user.id} className="hover:bg-blue-500/10/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#252a32] flex items-center justify-center">
                      <User className="w-5 h-5 text-[#d1c6ab]" />
                    </div>
                    <div>
                      <div className="font-medium text-[#dee2ec]">{user.username}</div>
                      <div className="text-xs text-[#8a92a6]">{user.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {(() => {
                    const badge = getRoleBadge(user.role);
                    return (
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border inline-flex items-center gap-1 shadow-xs ${badge.cls}`}>
                        {badge.text}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {user.status === 'Active' ? (
                       <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                       <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className={user.status === 'Active' ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>{user.status}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-[#8a92a6] text-sm font-mono">
                  {user.lastLogin}
                </td>
                <td className="px-6 py-4 text-right relative">
                  <button 
                    onClick={() => setActiveMenu(activeMenu === user.id ? null : user.id)}
                    className="text-[#8a92a6] hover:text-blue-600 transition-colors p-2 rounded-full hover:bg-[#252a32]"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                  
                  {activeMenu === user.id && (
                     <div className="absolute right-8 top-12 z-50 bg-[#171c23] border border-[#30353d] shadow-xl rounded-xl w-48 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <button 
                            onClick={() => handleEditUser(user)}
                            className="w-full text-left px-4 py-3 text-sm text-[#d1c6ab] hover:bg-[#1b2027] flex items-center gap-2"
                        >
                            <UserPlus className="w-4 h-4" /> {t('edit_user')}
                        </button>
                        <button 
                             onClick={() => handleDeleteUser(user.id)}
                            className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-500/10 flex items-center gap-2"
                        >
                            <XCircle className="w-4 h-4" /> {t('delete_user')}
                        </button>
                     </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Modal */}
      {showModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-[#171c23] border border-[#30353d] p-6 rounded-2xl w-full max-w-sm space-y-4 shadow-2xl">
                  <h3 className="text-lg font-bold text-[#dee2ec]">{isEditing ? t('edit_user') : t('add_new_user')}</h3>
                  
                  {/* Username */}
                  <div>
                      <label className="text-xs text-[#8a92a6] block mb-1">{t('username')}</label>
                      <input 
                        className="w-full bg-[#1b2027] border border-[#30353d] rounded p-2 text-[#dee2ec] outline-none focus:ring-2 focus:ring-blue-500" 
                        placeholder={t('username')}
                        value={newUser.username}
                        onChange={e => setNewUser({...newUser, username: e.target.value})}
                      />
                  </div>

                  {/* Password */}
                  <div>
                      <label className="text-xs text-[#8a92a6] block mb-1">{t('password')}</label>
                      <input 
                        type="password"
                        className="w-full bg-[#1b2027] border border-[#30353d] rounded p-2 text-[#dee2ec] outline-none focus:ring-2 focus:ring-blue-500" 
                        placeholder="******"
                        value={newUser.password}
                        onChange={e => setNewUser({...newUser, password: e.target.value})}
                      />
                  </div>

                  {/* Role */}
                  <div>
                      <label className="text-xs text-[#d1c6ab] font-bold block mb-1">บทบาทหน้าที่ &amp; แผนก (Role / Section)</label>
                      <select 
                         className="w-full bg-[#1b2027] border border-[#30353d] rounded-xl p-2.5 text-xs text-[#dee2ec] outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                         value={newUser.role}
                         onChange={e => {
                           const r = e.target.value;
                           if (r === 'Super Admin') {
                             setNewUser({ ...newUser, role: r, allowedBranches: ['*'] });
                           } else {
                             setNewUser({ ...newUser, role: r });
                           }
                         }}
                      >
                        <optgroup label="👑 ผู้บริหารระบบ (Management)">
                          <option value="Super Admin">👑 Super Admin — สิทธิ์สูงสุด ทุกเมนู ทุกสาขา</option>
                          <option value="Admin">💻 Admin — ผู้ดูแลคลังประจำสาขา จัดการระบบและทีมงาน</option>
                          <option value="Manager">👔 Manager — หัวหน้าคลัง จัดการสต็อก ออเดอร์ รายงาน</option>
                        </optgroup>
                        <optgroup label="📦 พนักงานคลังแบบกลุ่มงาน (Work Group)">
                          <option value="Staff">📱 Staff — เห็นทุกเมนู (พนักงานคลังทั่วไป)</option>
                          <option value="Staff - Inbound">📥 Staff — ฝั่งรับ (รับเข้า &amp; จัดเก็บ Putaway)</option>
                          <option value="Staff - Outbound">📦 Staff — ฝั่งจ่าย (หยิบ + QC/แพ็ก + จัดส่ง)</option>
                          <option value="Staff - Inventory">📋 Staff — งานในคลัง (ตรวจนับ/เช็คสต็อก)</option>
                        </optgroup>
                        <optgroup label="📱 พนักงานแยกย่อยตามแผนก (Fine-grained)">
                          <option value="Staff - Picker">🛒 Staff - Picker (หยิบสินค้าอย่างเดียว)</option>
                          <option value="Staff - QC &amp; Pack">🔍 Staff - QC &amp; Pack (ตรวจ QC &amp; แพ็กอย่างเดียว)</option>
                          <option value="Staff - Dispatch">🚚 Staff - Dispatch (ส่งมอบขนส่ง/POD อย่างเดียว)</option>
                        </optgroup>
                        <optgroup label="👁️ การตรวจสอบ (Audit)">
                          <option value="Viewer">👁️ Viewer — ดูข้อมูลและรายงานอย่างเดียว (Read-only)</option>
                        </optgroup>
                      </select>
                      <p className="text-[10px] text-[#d1c6ab] mt-1.5 leading-relaxed bg-[#1b2027] p-2 rounded-lg border border-[#30353d]">
                        {newUser.role === 'Super Admin' && '• Super Admin: สิทธิ์สูงสุด เข้าถึงข้อมูลทุกเมนู และเห็นข้อมูลทุกสาขาทั้งหมด'}
                        {newUser.role === 'Admin' && '• Admin: ดูแลระบบคลังประจำสาขา จัดการสต็อก ออเดอร์ ผู้ใช้ และเข้าใช้มือถือได้ทุก Section'}
                        {newUser.role === 'Manager' && '• Manager: หัวหน้าคลัง จัดการสินค้า ออเดอร์ลูกค้า วิเคราะห์รายงาน'}
                        {newUser.role === 'Staff - Inbound' && '• Inbound: แสดงเมนูรับสินค้าเข้า ตรวจนับ PO และจัดเก็บขึ้นชั้นวาง (Putaway)'}
                        {newUser.role === 'Staff - Picker' && '• Picker: แสดงเมนูหยิบสินค้า Wave Picking เดินตาม S-Shape พร้อมเสียงนำทาง'}
                        {newUser.role === 'Staff - QC & Pack' && '• QC & Pack: แสดงเมนูสถานีตรวจ QC ยิงเช็กบาร์โค้ด และแพ็กกล่องพิมพ์ใบปะหน้า'}
                        {newUser.role === 'Staff - Dispatch' && '• Dispatch: แสดงเมนูส่งมอบพัสดุให้ขนส่ง (Kerry/Flash/SPX) และงานคนขับส่งของ (POD)'}
                        {newUser.role === 'Staff - Inventory' && '• Inventory: แสดงเมนูตรวจนับ Cycle Count ค้นหาพิกัดเชลฟ์และตรวจนับสินค้า'}
                        {newUser.role === 'Staff' && '• Staff ทั่วไป: เข้าถึงเครื่องมือในแอพมือถือ (/mobile) ได้ทุก Section'}
                        {newUser.role === 'Viewer' && '• Viewer: ดูข้อมูลได้อย่างเดียว ไม่สามารถรับเข้า เบิกจ่าย หรือแก้ไขสต็อกได้'}
                      </p>
                  </div>

                  {/* Branch Access */}
                  <div>
                      <label className="text-xs text-[#8a92a6] block mb-1">
                        {t('allowed_branches')} {newUser.role === 'Super Admin' ? '(Super Admin เข้าถึงทุกสาขาโดยอัตโนมัติ)' : ''}
                      </label>
                      {newUser.role === 'Super Admin' ? (
                        <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl text-xs text-purple-700 font-medium">
                          ✓ บัญชี Super Admin ได้รับสิทธิ์เห็นข้อมูลทุกสาขาขององค์กร
                        </div>
                      ) : (
                        <div className="bg-[#1b2027] border border-[#30353d] rounded p-2 max-h-32 overflow-y-auto space-y-1">
                            {/* All Access Option */}
                            <label className="flex items-center gap-2 text-sm text-[#d1c6ab] cursor-pointer hover:bg-[#252a32] p-1 rounded">
                                <input 
                                    type="checkbox" 
                                    checked={newUser.allowedBranches?.includes('*')}
                                    onChange={() => toggleBranch('*')}
                                    className="rounded text-blue-600 focus:ring-blue-500"
                                />
                                 {t('all_branches')}
                            </label>
                            <div className="h-px bg-[#30353d] my-1"/>
                            {branches.map(b => (
                                <label key={b.id} className="flex items-center gap-2 text-sm text-[#d1c6ab] cursor-pointer hover:bg-[#252a32] p-1 rounded">
                                    <input 
                                        type="checkbox" 
                                        checked={!newUser.allowedBranches?.includes('*') && newUser.allowedBranches?.includes(b.id)}
                                        onChange={() => toggleBranch(b.id)}
                                        disabled={newUser.allowedBranches?.includes('*')}
                                        className="rounded text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                                    />
                                     <span className={`w-2 h-2 rounded-full bg-${b.color}-500 inline-block`}></span>
                                     {b.name}
                                </label>
                            ))}
                        </div>
                      )}
                  </div>

                  <div className="flex gap-2 justify-end pt-4">
                      <button onClick={() => setShowModal(false)} className="px-4 py-2 text-[#8a92a6] hover:text-[#dee2ec] hover:bg-[#252a32] rounded-xl font-bold">{t('cancel')}</button>
                      <button 
                        onClick={handleAddUser} 
                        disabled={!newUser.username || (!isEditing && !newUser.password)}
                        className="px-4 py-2 bg-blue-600 rounded text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isEditing ? t('save_changes') : t('save')}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
