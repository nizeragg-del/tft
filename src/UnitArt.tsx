import React, { useState } from 'react';
import { LucideIcon, Swords, Shield, Zap, Sparkles, Brain, FlaskConical, Target, Crosshair, Cpu, Clock, Waves, Mountain, Ghost, Skull, Sun, Moon } from 'lucide-react';

interface UnitArtProps {
    name: string;
    className?: string;
}

const ICON_MAP: Record<string, LucideIcon> = {
    'Vanguard': Shield,
    'Stinger': Target,
    'Ranger': Crosshair,
    'Scrap': Cpu,
    'Acolyte': FlaskConical,
    'Drone': Cpu,
    'Oracle': Brain,
    'Brawler': Shield,
    'Shadowblade': Ghost,
    'Sentinel': Shield,
    'Blaster': Target,
    'Nomad': Waves,
    'Sniper': Crosshair,
    'Void Terror': Skull,
    'Flux Mage': Clock,
    'Warlord': Swords,
    'Nanomancer': Sparkles,
    'Skyguardian': Sun,
    'Titan': Mountain,
    'Arcane Dragon': Sparkles,
    'Phantom': Ghost,
    'Stormcaller': Waves,
    'Mech-Pilot': Cpu,
    'Highblade': Swords,
    'The Core': Cpu,
    'Void Mother': Skull,
    'Time Keeper': Clock,
    'Starforger': Moon,
    'Deathwhisper': Ghost,
    'Omega': Cpu,
    'Melee Minion': Swords,
    'Caster Minion': Sparkles,
    'Krug': Mountain,
    'Murk Wolf': Ghost,
    'Razorbeak': Target,
};

const UnitArt: React.FC<UnitArtProps> = ({ name, className }) => {
    const [status, setStatus] = useState<'trying_jpg' | 'trying_png' | 'error'>('trying_jpg');
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    if (status === 'error' || !supabaseUrl) {
        const Icon = ICON_MAP[name] || Ghost;
        return (
            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-white/10 ${className}`}>
                <Icon size={48} className="text-white/40 opacity-50" />
            </div>
        );
    }

    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const extension = status === 'trying_jpg' ? 'jpg' : 'png';
    const imageUrl = `${supabaseUrl}/storage/v1/object/public/card-art/${cleanName}.${extension}`;

    return (
        <img
            src={imageUrl}
            alt={name}
            className={`w-full h-full object-cover rounded-lg ${className}`}
            onError={() => {
                if (status === 'trying_jpg') setStatus('trying_png');
                else setStatus('error');
            }}
        />
    );
};

export default UnitArt;
