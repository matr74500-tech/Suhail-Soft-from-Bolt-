import { Download } from 'lucide-react';

interface PlaceholderProps {
  title: string;
}

export default function Placeholder({ title }: PlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
      <Download className="w-12 h-12 mb-3 opacity-30" />
      <p className="text-lg font-medium">{title}</p>
      <p className="text-sm mt-1">سيتم تفعيل هذه الصفحة قريبًا</p>
    </div>
  );
}
