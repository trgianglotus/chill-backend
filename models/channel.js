export default (sequelize, DataTypes) => {
  const Channel = sequelize.define('channel', {
    name: DataTypes.STRING,
    public: DataTypes.BOOLEAN,
  });

  Channel.associate = (models) => {
    Channel.belongsToMany(models.Team, {
      through: 'member',
      foreignKey: 'teamId',
    });
  };

  return Channel;
};
