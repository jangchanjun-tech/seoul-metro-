import React from 'react';
import { AdminStats } from '../types';

interface AdminPanelProps {
  stats: AdminStats;
  isAutoGenerating: boolean;
  isBatchGenerating: boolean;
  onGenerate: (competency: string) => void;
  onToggleAuto: () => void;
  onGenerateAll: () => void;
  onBack: () => void;
}

const COMPETENCIES = [
    '지휘감독능력', '책임감 및 적극성', '관리자로서의 자세 및 청렴도', 
    '경영의식 및 혁신성', '업무의 이해도 및 상황대응력'
];

const AdminPanel: React.FC<AdminPanelProps> = ({ stats, isAutoGenerating, isBatchGenerating, onGenerate, onToggleAuto, onGenerateAll, onBack }) => {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-fade-in">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-indigo-300">관리자 패널</h1>
          <p className="text-gray-400">AI 문제 은행 관리 시스템</p>
        </div>
        <button onClick={onBack} className="bg-gray-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-gray-600 transition-all">홈으로</button>
      </header>

      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-lg p-6">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
            <h2 className="text-xl font-bold text-indigo-300">문제 은행 현황</h2>
            <div className="flex items-center gap-2">
                <button 
                    onClick={onGenerateAll}
                    disabled={isBatchGenerating || isAutoGenerating}
                    className="font-bold py-2 px-4 rounded-lg transition-colors bg-purple-600 hover:bg-purple-700 text-white disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    {isBatchGenerating ? '일괄 생성 중...' : '5과목 전체 생성 (+5)'}
                </button>
                <button 
                    onClick={onToggleAuto}
                    className={`font-bold py-2 px-4 rounded-lg transition-colors ${
                        isAutoGenerating 
                        ? 'bg-red-600 hover:bg-red-700 text-white' 
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                >
                    {isAutoGenerating ? '자동 생성 중지' : '자동 생성 시작'}
                </button>
            </div>
        </div>
        <div className="space-y-3">
          {COMPETENCIES.map(comp => (
            <div key={comp} className="bg-gray-700/50 p-4 rounded-lg flex justify-between items-center">
              <div>
                <p className="font-semibold text-white">{comp}</p>
                <p className="text-sm text-gray-400">저장된 문제: {stats[comp] ?? 0}개</p>
              </div>
              <button 
                onClick={() => onGenerate(comp)}
                className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-all text-sm"
              >
                1개 생성
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
