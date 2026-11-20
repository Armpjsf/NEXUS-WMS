'use client';

import { useState, useEffect } from 'react';
import { User, Shield, UserPlus, MoreVertical, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { motion } from 'framer-motion';

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
          method: 'POST',
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
          password: '',
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
      setActiveMenu(null);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'Super Admin':
        return { text: '👑 Super Admin (ทุกสาขา)', cls: 'border-amber-500/25 text-amber-800 bg-amber-500/15' };
      case 'Admin':
        return { text: '💻 แอดมินสาขา (Admin)', cls: 'border-sky-500/20 text-sky-700 bg-sky-500/12' };
      case 'Manager':
        return { text: '👔 หัวหน้าคลัง (Manager)', cls: 'border-sky-500/20 text-sky-800 bg-sky-500/12' };
      case 'Staff - Inbound':
        return { text: '📥 แผนกรับเข้า (Inbound)', cls: 'border-emerald-500/20 text-emerald-700 bg-emerald-500/12' };
      case 'Staff - Picker':
        return { text: '🛒 แผนกหยิบสินค้า (Picker)', cls: 'border-sky-500/20 text-sky-700 bg-sky-500/12' };
      case 'Staff - QC & Pack':
        return { text: '🔍 แผนกตรวจ QC & แพ็ก', cls: 'border-emerald-500/20 text-emerald-700 bg-emerald-500/12' };
      case 'Staff - Dispatch':
        return { text: '🚚 แผนกจัดส่ง & ขนส่ง', cls: 'border-amber-500/25 text-amber-800 bg-amber-500/15' };
      case 'Staff - Inventory':
        return { text: '📋 แผนกตรวจนับ (Inventory)', cls: 'border-amber-500/25 text-amber-800 bg-amber-500/15' };
      case 'Staff':
      case 'User':
        return { text: '📱 พนักงานคลังทั่วไป (Staff)', cls: 'border-amber-500/25 text-amber-800 bg-amber-500/15' };
      case 'Viewer':
        return { text: '👁️ ผู้ตรวจสอบ (Viewer)', cls: 'border-slate-200 text-slate-700 bg-slate-100' };
      default:
        return { text: role, cls: 'border-slate-200 text-slate-700 bg-slate-100' };
    }
  };

  return (
    <div className="theme-nexus-hybrid relative min-h-screen px-4 py-6 pb-32 sm:px-6 lg:p-8 text-slate-900">
      <div className="max-w-6xl mx-auto space-y-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-full bg-white/80 hover:bg-white border border-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all group w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          {t('back_to_admin')}
        </Link>

        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pt-1"
        >
           <div>
               <div className="flex items-center gap-2 mb-1.5">
                 <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                   <Shield className="w-3 h-3 text-sky-600" />
                   RBAC &amp; Branch Permissions
                 </span>
               </div>
               <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                   {t('admin_users_title')}
               </h1>
               <p className="text-xs sm:text-sm text-slate-600 mt-0.5">{t('admin_users_subtitle')}</p>
           </div>

           <button
               onClick={() => {
                  setNewUser({ id: '', username: '', password: '', role: 'Staff - Picker', allowedBranches: ['*'] });
                  setIsEditing(false);
                  setShowModal(true);
               }}
               className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-full flex items-center gap-2 text-xs font-semibold transition-all active:scale-95 shadow-sm"
           >
              <UserPlus className="w-4 h-4" />
              {t('add_user')}
           </button>
        </motion.div>

        <div className="nx-glass-card overflow-visible">
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full text-left text-slate-700 text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80 text-slate-500 uppercase font-bold text-[11px] tracking-wider">
                  <th className="px-6 py-3.5">{t('user_info')}</th>
                  <th className="px-6 py-3.5">{t('role')}</th>
                  <th className="px-6 py-3.5">{t('col_status')}</th>
                  <th className="px-6 py-3.5">{t('last_login')}</th>
                  <th className="px-6 py-3.5 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {loading ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-500 text-sm">{t('processing')}</td></tr>
                ) : users.map((user) => (
                  <tr key={user.id} className="hover:bg-white/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                          <User className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{user.username}</div>
                          <div className="text-xs text-slate-500 font-mono">{user.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const badge = getRoleBadge(user.role);
                        return (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-1 ${badge.cls}`}>
                            {badge.text}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-white/80 border-slate-200/80">
                        {user.status === 'Active' ? (
                           <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                           <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        )}
                        <span className={user.status === 'Active' ? 'text-emerald-700' : 'text-rose-700'}>{user.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs font-mono tabular-nums">
                      {user.lastLogin}
                    </td>
                    <td className="px-6 py-4 text-right relative">
                      <button
                        onClick={() => setActiveMenu(activeMenu === user.id ? null : user.id)}
                        className="text-slate-500 hover:text-slate-900 transition-colors p-2 rounded-full hover:bg-slate-100"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>

                      {activeMenu === user.id && (
                         <div className="absolute right-8 top-12 z-50 bg-white border border-slate-200/80 shadow-xl rounded-2xl w-48 overflow-hidden">
                            <button
                                onClick={() => handleEditUser(user)}
                                className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                            >
                                <UserPlus className="w-4 h-4" /> {t('edit_user')}
                            </button>
                            <button
                                 onClick={() => handleDeleteUser(user.id)}
                                className="w-full text-left px-4 py-3 text-sm font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2"
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
        </div>

        {/* Modal */}
        {showModal && (
            <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 p-6 rounded-3xl w-full max-w-sm space-y-4 shadow-2xl text-slate-900">
                    <h3 className="text-lg font-bold text-slate-900">{isEditing ? t('edit_user') : t('add_new_user')}</h3>

                    {/* Username */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 uppercase block mb-1">{t('username')}</label>
                        <input
                          className="w-full bg-white border border-slate-200/80 rounded-xl p-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          placeholder={t('username')}
                          value={newUser.username}
                          onChange={e => setNewUser({...newUser, username: e.target.value})}
                        />
                    </div>

                    {/* Password */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 uppercase block mb-1">{t('password')}</label>
                        <input
                          type="password"
                          className="w-full bg-white border border-slate-200/80 rounded-xl p-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          placeholder="******"
                          value={newUser.password}
                          onChange={e => setNewUser({...newUser, password: e.target.value})}
                        />
                    </div>

                    {/* Role */}
                    <div>
                        <label className="text-xs text-slate-600 font-bold uppercase block mb-1">บทบาทหน้าที่ &amp; แผนก (Role / Section)</label>
                        <select
                           className="w-full bg-white border border-slate-200/80 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
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
                        <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
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
                        <label className="text-xs font-bold text-slate-600 uppercase block mb-1">
                          {t('allowed_branches')} {newUser.role === 'Super Admin' ? '(Super Admin เข้าถึงทุกสาขาโดยอัตโนมัติ)' : ''}
                        </label>
                        {newUser.role === 'Super Admin' ? (
                          <div className="p-3 bg-amber-500/12 border border-amber-500/25 rounded-xl text-xs text-amber-800 font-medium">
                            ✓ บัญชี Super Admin ได้รับสิทธิ์เห็นข้อมูลทุกสาขาขององค์กร
                          </div>
                        ) : (
                          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2 max-h-32 overflow-y-auto space-y-1">
                              {/* All Access Option */}
                              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-white p-1.5 rounded-lg">
                                  <input
                                      type="checkbox"
                                      checked={newUser.allowedBranches?.includes('*')}
                                      onChange={() => toggleBranch('*')}
                                      className="rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                                  />
                                   {t('all_branches')}
                              </label>
                              <div className="h-px bg-slate-200 my-1"/>
                              {branches.map(b => (
                                  <label key={b.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:bg-white p-1.5 rounded-lg">
                                      <input
                                          type="checkbox"
                                          checked={!newUser.allowedBranches?.includes('*') && newUser.allowedBranches?.includes(b.id)}
                                          onChange={() => toggleBranch(b.id)}
                                          disabled={newUser.allowedBranches?.includes('*')}
                                          className="rounded text-emerald-600 focus:ring-emerald-500 disabled:opacity-50 border-slate-300"
                                      />
                                       <span className={`w-2 h-2 rounded-full bg-${b.color}-500 inline-block`}></span>
                                       {b.name}
                                  </label>
                              ))}
                          </div>
                        )}
                    </div>

                    <div className="flex gap-2 justify-end pt-4 border-t border-slate-200/80">
                        <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full text-xs font-semibold">{t('cancel')}</button>
                        <button
                          onClick={handleAddUser}
                          disabled={!newUser.username || (!isEditing && !newUser.password)}
                          className="px-5 py-2 bg-slate-900 hover:bg-slate-800 rounded-full text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isEditing ? t('save_changes') : t('save')}
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
