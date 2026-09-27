// import.meta.env는 이 파일에서만 읽는다.
export const env = {
	imageUrl: import.meta.env.VITE_APP_IMAGE_URL,
	musicUrl: import.meta.env.VITE_APP_MUSIC_URL,
	sfxUrl: import.meta.env.VITE_APP_SFX_URL,
	firebase: {
		apiKey: import.meta.env.VITE_APP_FIREBASE_API_KEY,
		authDomain: import.meta.env.VITE_APP_FIREBASE_AUTH_DOMAIN,
		databaseURL: import.meta.env.VITE_APP_FIREBASE_DATABASE_URL,
		projectId: import.meta.env.VITE_APP_FIREBASE_PROJECT_ID,
		storageBucket: import.meta.env.VITE_APP_FIREBASE_STORAGE_BUCKET,
		messagingSenderId: import.meta.env.VITE_APP_FIREBASE_MESSAGING_SENDER_ID,
		appId: import.meta.env.VITE_APP_FIREBASE_APP_ID,
		measurementId: import.meta.env.VITE_APP_FIREBASE_MEASUREMENT_ID,
	},
};
