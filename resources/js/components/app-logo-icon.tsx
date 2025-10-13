import { SVGAttributes } from 'react';
import { Clock } from 'lucide-react';

export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg {...props} viewBox="0 0 40 42" xmlns="http://www.w3.org/2000/svg">
            <Clock width={40} height={42} />
        </svg>
    );
}
