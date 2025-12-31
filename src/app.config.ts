export default defineAppConfig({
  pages: [
    'pages/record/quick/index',
    'pages/record/voice/index',
    'pages/record/index',
    'pages/transactions/index',
    'pages/analytics/index',
    'pages/settings/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: 'Bookkeeping',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: '#7c8794',
    selectedColor: '#1f2937',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/record/index',
        text: 'Record'
      },
      {
        pagePath: 'pages/transactions/index',
        text: 'Transactions'
      },
      {
        pagePath: 'pages/analytics/index',
        text: 'Analytics'
      },
      {
        pagePath: 'pages/settings/index',
        text: 'Settings'
      }
    ]
  }
})
