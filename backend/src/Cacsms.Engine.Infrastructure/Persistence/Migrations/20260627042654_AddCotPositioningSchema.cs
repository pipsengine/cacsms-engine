using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cacsms.Engine.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCotPositioningSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "cot_positioning_snapshots",
                schema: "engine",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    report_date = table.Column<DateOnly>(type: "date", nullable: false),
                    release_date = table.Column<DateOnly>(type: "date", nullable: false),
                    reporting_period = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    data_source = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    server = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    server_status = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    net_position_all = table.Column<int>(type: "int", nullable: false),
                    total_long = table.Column<int>(type: "int", nullable: false),
                    total_short = table.Column<int>(type: "int", nullable: false),
                    long_short_ratio = table.Column<decimal>(type: "decimal(8,2)", precision: 8, scale: 2, nullable: false),
                    total_traders = table.Column<int>(type: "int", nullable: false),
                    open_interest = table.Column<int>(type: "int", nullable: false),
                    total_contracts = table.Column<int>(type: "int", nullable: false),
                    non_commercial_net = table.Column<int>(type: "int", nullable: false),
                    commercial_net = table.Column<int>(type: "int", nullable: false),
                    non_reportable_net = table.Column<int>(type: "int", nullable: false),
                    bias = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    institutional_sentiment = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cot_positioning_snapshots", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "cot_positioning_rows",
                schema: "engine",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    snapshot_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    symbol = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    currency_name = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    display_code = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    @long = table.Column<int>(name: "long", type: "int", nullable: false),
                    @short = table.Column<int>(name: "short", type: "int", nullable: false),
                    change_long = table.Column<int>(type: "int", nullable: false),
                    change_short = table.Column<int>(type: "int", nullable: false),
                    percent_change = table.Column<decimal>(type: "decimal(8,2)", precision: 8, scale: 2, nullable: false),
                    net_positions = table.Column<int>(type: "int", nullable: false),
                    bias = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cot_positioning_rows", x => x.id);
                    table.ForeignKey(
                        name: "FK_cot_positioning_rows_cot_positioning_snapshots_snapshot_id",
                        column: x => x.snapshot_id,
                        principalSchema: "engine",
                        principalTable: "cot_positioning_snapshots",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ux_cot_positioning_rows_snapshot_symbol",
                schema: "engine",
                table: "cot_positioning_rows",
                columns: new[] { "snapshot_id", "symbol" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_cot_positioning_snapshots_report_date",
                schema: "engine",
                table: "cot_positioning_snapshots",
                column: "report_date",
                descending: new bool[0]);

            migrationBuilder.CreateIndex(
                name: "ux_cot_positioning_snapshots_report_source",
                schema: "engine",
                table: "cot_positioning_snapshots",
                columns: new[] { "report_date", "data_source" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "cot_positioning_rows",
                schema: "engine");

            migrationBuilder.DropTable(
                name: "cot_positioning_snapshots",
                schema: "engine");
        }
    }
}
