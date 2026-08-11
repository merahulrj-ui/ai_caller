import { registerWebModule, NativeModule } from 'expo';

class CallmanagerModule extends NativeModule<{}> {}

export default registerWebModule(CallmanagerModule, 'CallmanagerModule');
