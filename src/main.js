import Vue from 'vue';
import App from './App.vue';

import Button from 'primevue/button';
import Card from 'primevue/card';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Slider from 'primevue/slider';
import TabPanel from 'primevue/tabpanel';
import TabView from 'primevue/tabview';
import Toast from 'primevue/toast';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';

Vue.use(ToastService);

Vue.component('Button', Button);
Vue.component('Card', Card);
Vue.component('Dropdown', Dropdown);
Vue.component('InputText', InputText);
Vue.component('Message', Message);
Vue.component('Slider', Slider);
Vue.component('TabPanel', TabPanel);
Vue.component('TabView', TabView);
Vue.component('Toast', Toast);

Vue.directive('tooltip', Tooltip);

// import 'primevue/resources/themes/nova/theme.css';
import 'primevue/resources/themes/saga-blue/theme.css';
import 'primevue/resources/primevue.min.css';
import 'primeicons/primeicons.css';
import 'primeflex/primeflex.css';

//moday.com
import mondaySdk from "monday-sdk-js";
const monday = mondaySdk();
Object.defineProperty(Vue.prototype, '$monday', { value: monday });

Vue.prototype.$primevue = {ripple: true};

Vue.config.productionTip = false;
//Vue.config.devtools = true;

new Vue({
  render: h => h(App),
}).$mount('#app')