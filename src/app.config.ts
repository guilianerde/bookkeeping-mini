export default defineAppConfig({
  pages: [
    'pages/record/index',
    'pages/login/index',
    'pages/transactions/index',
    // TODO: v1 暂时隐藏分析页
    // 'pages/analytics/index',
    'pages/settings/index',
    'pages/record/quick/index',
    'pages/record/voice/index',
    'pages/group/index',
    'pages/group/record/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#f5f5f7',
    navigationBarTitleText: 'Bookkeeping',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: '#8e8e93',
    selectedColor: '#5b8cff',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/record/index',
        text: '记账',
        iconPath: 'assets/tabbar/record.png',
        selectedIconPath: 'assets/tabbar/record-active.png'
      },
      {
        pagePath: 'pages/transactions/index',
        text: '明细',
        iconPath: 'assets/tabbar/transactions.png',
        selectedIconPath: 'assets/tabbar/transactions-active.png'
      },
      // TODO: v1 暂时隐藏分析页
      // {
      //   pagePath: 'pages/analytics/index',
      //   text: '分析',
      //   iconPath: 'assets/tabbar/analytics.png',
      //   selectedIconPath: 'assets/tabbar/analytics-active.png'
      // },
      {
        pagePath: 'pages/settings/index',
        text: '设置',
        iconPath: 'assets/tabbar/settings.png',
        selectedIconPath: 'assets/tabbar/settings-active.png'
      }
    ]
  }
})
