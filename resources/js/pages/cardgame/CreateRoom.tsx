import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';

function CreateRoom(){
    return(
        <AppLayout>
            <Head title="Create a room" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
            </div>
        </AppLayout>
    )
}
export default CreateRoom;