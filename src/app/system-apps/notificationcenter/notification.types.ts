export interface Notification {
    id: string;
    srcTitle: string;
    message: string;
    srcIcon: string;
    isRead: boolean;
    isImage: boolean;
    imageSrc: string;
    imageDataUrl: string;
    //actions?: NotificationAction[];
    timeout: number;
    timestamp: Date;
}

// export interface NotificationAction {
//     label: string;
//     callback: () => void;
// }