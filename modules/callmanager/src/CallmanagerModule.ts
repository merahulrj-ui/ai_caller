import { NativeModule, requireNativeModule } from 'expo';

declare class CallmanagerModule extends NativeModule<{}> {}

export default requireNativeModule<CallmanagerModule>('Callmanager');
